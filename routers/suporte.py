import os
from datetime import UTC, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from audit_log import registrar_evento_auditoria
from database import get_db
from email_utils import enviar_email_smtp
from models import SuporteChamadoDB, SuporteChamadoMensagemDB, UsuarioDB
from schemas import (
    SuporteChamadoCreate,
    SuporteChamadoMensagemCreate,
    SuporteChamadoResponse,
    SuporteChamadosListResponse,
    SuporteChamadoStatusUpdate,
)
from security import get_usuario_logado, usuario_eh_manutencao


router = APIRouter(prefix="/api/suporte", tags=["Suporte"])


def _usuario_id(usuario_atual: dict) -> str:
    usuario_id = usuario_atual.get("sub") or usuario_atual.get("id") or usuario_atual.get("usuario_id")
    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário logado inválido. Faça login novamente.",
        )
    return usuario_id


def _instituicao_id(usuario_atual: dict) -> str:
    instituicao_id = usuario_atual.get("instituicao_id")
    if not instituicao_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Instituição do usuário não encontrada no token.",
        )
    return instituicao_id


def _pode_gerenciar_suporte(usuario_atual: dict) -> bool:
    perfil = (usuario_atual.get("perfil_acesso") or "").lower()
    return usuario_eh_manutencao(usuario_atual) or bool(usuario_atual.get("is_master")) or bool(usuario_atual.get("is_global")) or perfil in {
        "gestor",
        "gestão",
        "gestao",
        "administrador",
        "admin",
    }


def _agora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def _gerar_numero_ticket(db: AsyncSession) -> str:
    ano = _agora().year
    prefixo = f"SUP-{ano}-"

    resultado = await db.execute(
        select(func.count(SuporteChamadoDB.id)).where(
            SuporteChamadoDB.numero_ticket.like(f"{prefixo}%")
        )
    )
    proximo = int(resultado.scalar_one() or 0) + 1
    return f"{prefixo}{proximo:06d}"


async def _usuarios_por_ids(db: AsyncSession, ids: list[str]) -> dict[str, UsuarioDB]:
    ids_validos = [usuario_id for usuario_id in set(ids) if usuario_id]
    if not ids_validos:
        return {}

    resultado = await db.execute(select(UsuarioDB).where(UsuarioDB.id.in_(ids_validos)))
    return {usuario.id: usuario for usuario in resultado.scalars().all()}


async def _mensagens_chamado(
    db: AsyncSession,
    chamado_id: str,
) -> list[SuporteChamadoMensagemDB]:
    resultado = await db.execute(
        select(SuporteChamadoMensagemDB)
        .where(
            SuporteChamadoMensagemDB.chamado_id == chamado_id,
            SuporteChamadoMensagemDB.publico == True,  # noqa: E712
        )
        .order_by(SuporteChamadoMensagemDB.criado_em.asc())
    )
    return resultado.scalars().all()


async def _chamado_para_response(
    db: AsyncSession,
    chamado: SuporteChamadoDB,
    incluir_mensagens: bool = False,
) -> SuporteChamadoResponse:
    usuarios = await _usuarios_por_ids(db, [chamado.usuario_id])
    usuario = usuarios.get(chamado.usuario_id)
    mensagens = await _mensagens_chamado(db, chamado.id) if incluir_mensagens else []

    return SuporteChamadoResponse(
        id=chamado.id,
        numero_ticket=chamado.numero_ticket,
        instituicao_id=chamado.instituicao_id,
        organizacao_id=chamado.organizacao_id,
        usuario_id=chamado.usuario_id,
        usuario_nome=usuario.nome if usuario else None,
        usuario_email=usuario.email if usuario else None,
        modulo=chamado.modulo,
        tela=chamado.tela,
        tipo_problema=chamado.tipo_problema,
        caminho_sistema=chamado.caminho_sistema,
        url_origem=chamado.url_origem,
        prioridade=chamado.prioridade,
        status=chamado.status,
        assunto=chamado.assunto,
        relato=chamado.relato,
        email_notificacao_enviado=bool(chamado.email_notificacao_enviado),
        criado_em=chamado.criado_em,
        atualizado_em=chamado.atualizado_em,
        resolvido_em=chamado.resolvido_em,
        mensagens=mensagens,
    )


async def _obter_chamado_autorizado(
    db: AsyncSession,
    chamado_id: str,
    usuario_atual: dict,
) -> SuporteChamadoDB:
    usuario_id = _usuario_id(usuario_atual)

    filtros = [SuporteChamadoDB.id == chamado_id]
    if not usuario_eh_manutencao(usuario_atual):
        filtros.append(SuporteChamadoDB.instituicao_id == _instituicao_id(usuario_atual))

    resultado = await db.execute(
        select(SuporteChamadoDB).where(*filtros)
    )
    chamado = resultado.scalar_one_or_none()

    if not chamado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chamado não encontrado.",
        )

    if chamado.usuario_id != usuario_id and not _pode_gerenciar_suporte(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para acessar este chamado.",
        )

    return chamado


async def _notificar_suporte_por_email(chamado: SuporteChamadoDB, usuario_atual: dict) -> tuple[bool, Optional[str]]:
    corpo = f"""Novo chamado de suporte aberto no CareCore+

Ticket: {chamado.numero_ticket}
Status: {chamado.status}
Prioridade: {chamado.prioridade}

Aberto por: {usuario_atual.get("nome") or "Usuário"}
E-mail do usuário: {usuario_atual.get("email") or "-"}
Perfil: {usuario_atual.get("perfil_acesso") or "-"}
Instituição: {chamado.instituicao_id}

Caminho: {chamado.caminho_sistema}
Módulo: {chamado.modulo}
Tela: {chamado.tela}
Tipo: {chamado.tipo_problema}
URL: {chamado.url_origem or "-"}

Assunto:
{chamado.assunto}

Relato:
{chamado.relato}
"""

    resultado = await run_in_threadpool(
        enviar_email_smtp,
        assunto=f"[CareCore+ Suporte] {chamado.numero_ticket} - {chamado.assunto}",
        corpo=corpo,
    )
    return resultado.enviado, resultado.erro


async def _notificar_usuario_atualizacao_chamado(
    db: AsyncSession,
    chamado: SuporteChamadoDB,
    *,
    tipo_evento: str,
    usuario_atual: dict,
    mensagem: Optional[str] = None,
    status_anterior: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    usuarios = await _usuarios_por_ids(db, [chamado.usuario_id])
    usuario_abertura = usuarios.get(chamado.usuario_id)

    if not usuario_abertura or not usuario_abertura.email:
        return False, "Usuário de abertura sem e-mail para notificação."

    if usuario_abertura.id == _usuario_id(usuario_atual):
        return False, None

    if tipo_evento == "status":
        titulo = f"Status do chamado {chamado.numero_ticket} atualizado"
        detalhe_evento = f"Status anterior: {status_anterior or '-'}\nNovo status: {chamado.status}"
    else:
        titulo = f"Nova resposta no chamado {chamado.numero_ticket}"
        detalhe_evento = f"Resposta de {usuario_atual.get('nome') or 'Suporte'}:\n{mensagem or '-'}"

    corpo = f"""Atualização de chamado CareCore+

Ticket: {chamado.numero_ticket}
Assunto: {chamado.assunto}
Status atual: {chamado.status}
Caminho: {chamado.caminho_sistema}

{detalhe_evento}

Relato original:
{chamado.relato}
"""

    resultado_usuario = await run_in_threadpool(
        enviar_email_smtp,
        assunto=f"[CareCore+ Suporte] {titulo}",
        corpo=corpo,
        para=usuario_abertura.email,
    )

    destinatario_suporte = os.getenv("CARECORE_SUPORTE_EMAIL_DESTINO", "").strip().lower()
    if destinatario_suporte and destinatario_suporte != usuario_abertura.email.lower().strip():
        corpo_suporte = f"""Cópia de atualização de chamado CareCore+

Destinatário principal: {usuario_abertura.nome} <{usuario_abertura.email}>

{corpo}
"""
        resultado_suporte = await run_in_threadpool(
            enviar_email_smtp,
            assunto=f"[CareCore+ Suporte][Cópia] {titulo}",
            corpo=corpo_suporte,
            para=destinatario_suporte,
        )

        if not resultado_usuario.enviado:
            return False, resultado_usuario.erro

        if not resultado_suporte.enviado:
            return False, resultado_suporte.erro

        return True, None

    return resultado_usuario.enviado, resultado_usuario.erro


@router.post("/chamados", response_model=SuporteChamadoResponse, status_code=status.HTTP_201_CREATED)
async def criar_chamado_suporte(
    payload: SuporteChamadoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)
    agora = _agora()

    chamado = SuporteChamadoDB(
        numero_ticket=await _gerar_numero_ticket(db),
        instituicao_id=instituicao_id,
        organizacao_id=usuario_atual.get("organizacao_id"),
        usuario_id=usuario_id,
        modulo=payload.modulo,
        tela=payload.tela,
        tipo_problema=payload.tipo_problema,
        caminho_sistema=payload.caminho_sistema,
        url_origem=payload.url_origem,
        prioridade=payload.prioridade,
        status="Aberto",
        assunto=payload.assunto,
        relato=payload.relato,
        criado_em=agora,
    )
    db.add(chamado)
    await db.flush()

    db.add(
        SuporteChamadoMensagemDB(
            chamado_id=chamado.id,
            instituicao_id=instituicao_id,
            usuario_id=usuario_id,
            autor_nome=usuario_atual.get("nome") or "Usuário",
            autor_tipo="usuario",
            mensagem=payload.relato,
            publico=True,
            criado_em=agora,
        )
    )

    enviado, erro = await _notificar_suporte_por_email(chamado, usuario_atual)
    chamado.email_notificacao_enviado = enviado
    chamado.email_notificacao_erro = erro

    await db.commit()
    await db.refresh(chamado)

    registrar_evento_auditoria(
        "suporte_chamado_criado",
        usuario_atual=usuario_atual,
        chamado_id=chamado.id,
        numero_ticket=chamado.numero_ticket,
        email_notificacao_enviado=enviado,
    )

    return await _chamado_para_response(db, chamado, incluir_mensagens=True)


@router.get("/chamados", response_model=SuporteChamadosListResponse)
async def listar_chamados_suporte(
    busca: Optional[str] = None,
    status_filtro: Optional[str] = None,
    escopo: str = Query(default="meus", pattern="^(meus|todos)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    filtros = []
    if not usuario_eh_manutencao(usuario_atual):
        filtros.append(SuporteChamadoDB.instituicao_id == _instituicao_id(usuario_atual))

    if escopo == "todos":
        if not _pode_gerenciar_suporte(usuario_atual):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para consultar todos os chamados.",
            )
    else:
        filtros.append(SuporteChamadoDB.usuario_id == usuario_id)

    if status_filtro:
        filtros.append(SuporteChamadoDB.status == status_filtro)

    if busca:
        termo = f"%{busca.strip()}%"
        filtros.append(
            or_(
                SuporteChamadoDB.numero_ticket.ilike(termo),
                SuporteChamadoDB.assunto.ilike(termo),
                SuporteChamadoDB.relato.ilike(termo),
                SuporteChamadoDB.caminho_sistema.ilike(termo),
            )
        )

    consulta_total = select(func.count(SuporteChamadoDB.id))
    if filtros:
        consulta_total = consulta_total.where(*filtros)
    total_resultado = await db.execute(consulta_total)
    total = int(total_resultado.scalar_one() or 0)

    resultado = await db.execute(
        (
            select(SuporteChamadoDB).where(*filtros)
            if filtros
            else select(SuporteChamadoDB)
        )
        .order_by(SuporteChamadoDB.criado_em.desc())
        .offset(offset)
        .limit(limit)
    )
    chamados = resultado.scalars().all()

    return SuporteChamadosListResponse(
        items=[await _chamado_para_response(db, chamado) for chamado in chamados],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + limit < total,
    )


@router.get("/chamados/{chamado_id}", response_model=SuporteChamadoResponse)
async def obter_chamado_suporte(
    chamado_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    chamado = await _obter_chamado_autorizado(db, chamado_id, usuario_atual)
    return await _chamado_para_response(db, chamado, incluir_mensagens=True)


@router.post("/chamados/{chamado_id}/mensagens", response_model=SuporteChamadoResponse)
async def responder_chamado_suporte(
    chamado_id: str,
    payload: SuporteChamadoMensagemCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    chamado = await _obter_chamado_autorizado(db, chamado_id, usuario_atual)
    usuario_id = _usuario_id(usuario_atual)
    agora = _agora()
    gerencia = _pode_gerenciar_suporte(usuario_atual)

    db.add(
        SuporteChamadoMensagemDB(
            chamado_id=chamado.id,
            instituicao_id=chamado.instituicao_id,
            usuario_id=usuario_id,
            autor_nome=usuario_atual.get("nome") or "Usuário",
            autor_tipo="suporte" if gerencia else "usuario",
            mensagem=payload.mensagem,
            publico=True,
            criado_em=agora,
        )
    )
    chamado.atualizado_em = agora

    if gerencia and chamado.status == "Aberto":
        chamado.status = "Em análise"

    if gerencia:
        enviado, erro = await _notificar_usuario_atualizacao_chamado(
            db,
            chamado,
            tipo_evento="resposta",
            usuario_atual=usuario_atual,
            mensagem=payload.mensagem,
        )
        registrar_evento_auditoria(
            "suporte_chamado_resposta_notificacao",
            usuario_atual=usuario_atual,
            chamado_id=chamado.id,
            numero_ticket=chamado.numero_ticket,
            email_notificacao_enviado=enviado,
            email_notificacao_erro=erro,
        )

    await db.commit()
    await db.refresh(chamado)

    registrar_evento_auditoria(
        "suporte_chamado_respondido",
        usuario_atual=usuario_atual,
        chamado_id=chamado.id,
        numero_ticket=chamado.numero_ticket,
    )

    return await _chamado_para_response(db, chamado, incluir_mensagens=True)


@router.patch("/chamados/{chamado_id}/status", response_model=SuporteChamadoResponse)
async def atualizar_status_chamado_suporte(
    chamado_id: str,
    payload: SuporteChamadoStatusUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    if not _pode_gerenciar_suporte(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para alterar status de chamados.",
        )

    chamado = await _obter_chamado_autorizado(db, chamado_id, usuario_atual)
    agora = _agora()
    status_anterior = chamado.status
    chamado.status = payload.status
    chamado.atualizado_em = agora
    chamado.resolvido_em = agora if payload.status in {"Resolvido", "Cancelado"} else None

    enviado, erro = await _notificar_usuario_atualizacao_chamado(
        db,
        chamado,
        tipo_evento="status",
        usuario_atual=usuario_atual,
        status_anterior=status_anterior,
    )

    await db.commit()
    await db.refresh(chamado)

    registrar_evento_auditoria(
        "suporte_chamado_status_atualizado",
        usuario_atual=usuario_atual,
        chamado_id=chamado.id,
        numero_ticket=chamado.numero_ticket,
        status=payload.status,
        email_notificacao_enviado=enviado,
        email_notificacao_erro=erro,
    )

    return await _chamado_para_response(db, chamado, incluir_mensagens=True)
