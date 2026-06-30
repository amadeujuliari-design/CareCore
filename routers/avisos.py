# =====================================================================
# ARQUIVO: routers/avisos.py
# =====================================================================
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AvisoDB, AvisoDestinatarioDB, UsuarioDB
from schemas import (
    AvisoCreate,
    AvisoDashboardResponse,
    AvisoHistoricoListResponse,
    AvisoMeListResponse,
    AvisoResponse,
    AvisosResumoResponse,
    AvisoUpdate,
)
from security import get_usuario_logado
from time_operacional import agora_operacional_naive, parse_data_filtro_operacional
from revisao_texto import sanitizar_aviso_para_usuario

router = APIRouter(prefix="/api/avisos", tags=["Avisos e Comunicação Interna"])


def _usuario_id(usuario_atual: dict) -> str:
    usuario_id = usuario_atual.get("sub") or usuario_atual.get("id")
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


def _usuario_eh_gestor(usuario_atual: dict) -> bool:
    perfil = (usuario_atual.get("perfil_acesso") or usuario_atual.get("perfil") or "").lower()
    return bool(usuario_atual.get("is_master")) or perfil in {
        "gestor",
        "gestora",
        "gestao",
        "gestão",
        "gerente",
        "administrador",
        "admin",
        "coordenador",
        "coordenadora",
    }


def _pode_gerenciar_avisos(usuario_atual: dict) -> bool:
    # Mantido para edição/cancelamento. O envio/criação de avisos fica liberado
    # para usuários autenticados, conforme regra operacional definida.
    return _usuario_eh_gestor(usuario_atual)


def _pode_consultar_historico_avisos(usuario_atual: dict) -> bool:
    perfil = (usuario_atual.get("perfil_acesso") or usuario_atual.get("perfil") or "").lower()
    return _pode_gerenciar_avisos(usuario_atual) or perfil in {
        "global",
        "técnico",
        "tecnico",
        "orientador",
        "orientadora",
    }


def _agora_operacional_naive() -> datetime:
    return agora_operacional_naive()


def _aviso_para_resposta(aviso: AvisoDB, usuario_atual: dict) -> dict:
    dados = {c.name: getattr(aviso, c.name) for c in aviso.__table__.columns}
    return sanitizar_aviso_para_usuario(dados, usuario_atual)


def _aviso_ativo_e_valido():
    agora = _agora_operacional_naive()
    return and_(
        AvisoDB.ativo == True,  # noqa: E712
        AvisoDB.cancelado_em.is_(None),
        or_(AvisoDB.valido_ate.is_(None), AvisoDB.valido_ate >= agora),
    )


def _parse_data_filtro(valor: Optional[str], fim_do_dia: bool = False) -> Optional[datetime]:
    if not valor:
        return None

    try:
        return parse_data_filtro_operacional(valor, fim_do_dia=fim_do_dia)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data inválida. Use o formato AAAA-MM-DD.",
        )


async def _ids_destinatarios_validos(
    db: AsyncSession,
    instituicao_id: str,
    destinatarios_ids: List[str],
) -> List[str]:
    ids_limpos = list(dict.fromkeys([uid for uid in destinatarios_ids if uid]))

    if not ids_limpos:
        return []

    resultado = await db.execute(
        select(UsuarioDB.id).where(
            UsuarioDB.instituicao_id == instituicao_id,
            UsuarioDB.id.in_(ids_limpos),
        )
    )
    ids_validos = [linha[0] for linha in resultado.all()]

    if len(ids_validos) != len(ids_limpos):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Um ou mais destinatários não pertencem à instituição atual.",
        )

    return ids_validos


async def _usuario_pode_ver_aviso(
    db: AsyncSession,
    aviso: AvisoDB,
    usuario_id: str,
    instituicao_id: str,
    usuario_atual: dict,
) -> bool:
    if aviso.instituicao_id != instituicao_id:
        return False

    # Gestores têm visão total da comunicação interna da instituição.
    if _usuario_eh_gestor(usuario_atual):
        return True

    if aviso.destino_tipo == "todos":
        return True

    resultado = await db.execute(
        select(AvisoDestinatarioDB.id).where(
            AvisoDestinatarioDB.aviso_id == aviso.id,
            AvisoDestinatarioDB.usuario_id == usuario_id,
        )
    )
    return resultado.scalar_one_or_none() is not None



@router.get("/usuarios")
async def listar_usuarios_para_destinatarios(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """
    Lista usuários ativos da mesma instituição para seleção visual de destinatários
    na tela de Comunicação Interna.
    """
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    resultado = await db.execute(
        select(UsuarioDB)
        .where(UsuarioDB.instituicao_id == instituicao_id)
        .order_by(UsuarioDB.nome.asc())
    )

    usuarios = []
    for usuario in resultado.scalars().all():
        usuarios.append(
            {
                "id": usuario.id,
                "nome": usuario.nome,
                "email": usuario.email,
                "perfil_acesso": usuario.perfil_acesso,
                "is_master": bool(usuario.is_master),
                "sou_eu": usuario.id == usuario_id,
            }
        )

    return usuarios


@router.post("", response_model=AvisoResponse, status_code=status.HTTP_201_CREATED)
async def criar_aviso(
    payload: AvisoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    destino_tipo = (payload.destino_tipo or "todos").strip().lower()
    if destino_tipo not in {"todos", "usuarios"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='destino_tipo deve ser "todos" ou "usuarios".',
        )

    destinatarios_ids = await _ids_destinatarios_validos(
        db,
        instituicao_id,
        payload.destinatarios_ids or [],
    )

    if destino_tipo == "usuarios" and not destinatarios_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Informe ao menos um destinatário quando destino_tipo for "usuarios".',
        )

    novo_aviso = AvisoDB(
        instituicao_id=instituicao_id,
        remetente_id=usuario_id,
        titulo=payload.titulo.strip(),
        mensagem=payload.mensagem.strip(),
        titulo_original=(payload.titulo_original or "").strip() or None,
        mensagem_original=(payload.mensagem_original or "").strip() or None,
        classificacao=(payload.classificacao or "Informativo").strip(),
        prioridade=(payload.prioridade or "normal").strip().lower(),
        destino_tipo=destino_tipo,
        ativo=payload.ativo,
        valido_ate=payload.valido_ate,
        criado_em=_agora_operacional_naive(),
    )

    db.add(novo_aviso)
    await db.flush()

    # Para mensagens específicas, cria a relação de visualização/leitura.
    # Para mensagens para todos, a relação é criada somente quando o usuário marcar como lida.
    if destino_tipo == "usuarios":
        for destinatario_id in destinatarios_ids:
            db.add(
                AvisoDestinatarioDB(
                    aviso_id=novo_aviso.id,
                    usuario_id=destinatario_id,
                )
            )

    await db.commit()
    await db.refresh(novo_aviso)

    return _aviso_para_resposta(novo_aviso, usuario_atual)


@router.get("/me", response_model=AvisoMeListResponse)
async def listar_meus_avisos(
    somente_nao_lidos: bool = False,
    limite: int = 10,
    offset: int = Query(0, ge=0),
    busca: Optional[str] = None,
    classificacao: Optional[str] = None,
    prioridade: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    limite = max(1, min(limite, 100))

    consulta = (
        select(
            AvisoDB,
            UsuarioDB.nome,
            UsuarioDB.avatar_url,
            UsuarioDB.perfil_acesso,
            AvisoDestinatarioDB.lido,
            AvisoDestinatarioDB.lido_em,
        )
        .join(UsuarioDB, UsuarioDB.id == AvisoDB.remetente_id)
        .outerjoin(
            AvisoDestinatarioDB,
            and_(
                AvisoDestinatarioDB.aviso_id == AvisoDB.id,
                AvisoDestinatarioDB.usuario_id == usuario_id,
            ),
        )
        .where(
            AvisoDB.instituicao_id == instituicao_id,
            _aviso_ativo_e_valido(),
        )
    )

    if not _usuario_eh_gestor(usuario_atual):
        consulta = consulta.where(
            or_(
                AvisoDB.destino_tipo == "todos",
                AvisoDestinatarioDB.usuario_id == usuario_id,
            )
        )

    if somente_nao_lidos:
        consulta = consulta.where(
            or_(
                AvisoDestinatarioDB.lido.is_(None),
                AvisoDestinatarioDB.lido == False,  # noqa: E712
            )
        )

    busca_limpa = (busca or "").strip()
    if busca_limpa:
        termo = f"%{busca_limpa}%"
        consulta = consulta.where(
            or_(
                AvisoDB.titulo.ilike(termo),
                AvisoDB.mensagem.ilike(termo),
            )
        )

    classificacao_limpa = (classificacao or "").strip()
    if classificacao_limpa:
        consulta = consulta.where(AvisoDB.classificacao == classificacao_limpa)

    prioridade_limpa = (prioridade or "").strip()
    if prioridade_limpa and prioridade_limpa != "Todas":
        consulta = consulta.where(AvisoDB.prioridade == prioridade_limpa)

    inicio = _parse_data_filtro(data_inicio)
    if inicio:
        consulta = consulta.where(AvisoDB.criado_em >= inicio)

    fim = _parse_data_filtro(data_fim, fim_do_dia=True)
    if fim:
        consulta = consulta.where(AvisoDB.criado_em <= fim)

    ids_subconsulta = consulta.with_only_columns(AvisoDB.id).order_by(None).distinct().subquery()
    total = (await db.execute(select(func.count()).select_from(ids_subconsulta))).scalar_one()

    resultado = await db.execute(
        consulta.order_by(AvisoDB.criado_em.desc()).offset(offset).limit(limite)
    )

    avisos = []
    for aviso, remetente_nome, remetente_avatar_url, remetente_perfil_acesso, lido, lido_em in resultado.all():
        lido_bool = bool(lido)
        pode_exibir_titulo = aviso.destino_tipo == "todos" or _usuario_eh_gestor(usuario_atual)
        dados_sanitizados = sanitizar_aviso_para_usuario(
            {c.name: getattr(aviso, c.name) for c in aviso.__table__.columns},
            usuario_atual,
        )

        avisos.append(
            AvisoDashboardResponse(
                id=aviso.id,
                remetente_id=aviso.remetente_id,
                remetente_nome=remetente_nome,
                remetente_avatar_url=remetente_avatar_url,
                remetente_perfil_acesso=remetente_perfil_acesso,
                titulo=aviso.titulo if pode_exibir_titulo else "Você tem uma mensagem",
                mensagem=aviso.mensagem,
                mensagem_resumo=(
                    aviso.mensagem
                    if pode_exibir_titulo
                    else "Mensagem interna direcionada a você. Clique para ler a mensagem completa."
                ),
                classificacao=aviso.classificacao,
                prioridade=aviso.prioridade,
                destino_tipo=aviso.destino_tipo,
                lido=lido_bool,
                lido_em=lido_em,
                criado_em=aviso.criado_em,
                valido_ate=aviso.valido_ate,
                pode_exibir_titulo=pode_exibir_titulo,
                titulo_original=dados_sanitizados.get("titulo_original"),
                mensagem_original=dados_sanitizados.get("mensagem_original"),
            )
        )

    total_int = int(total or 0)

    return {
        "items": avisos,
        "total": total_int,
        "limit": limite,
        "offset": offset,
        "has_more": offset + len(avisos) < total_int,
    }


@router.get("/me/resumo", response_model=AvisosResumoResponse)
async def resumo_meus_avisos(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    base = (
        select(func.count(AvisoDB.id))
        .outerjoin(
            AvisoDestinatarioDB,
            and_(
                AvisoDestinatarioDB.aviso_id == AvisoDB.id,
                AvisoDestinatarioDB.usuario_id == usuario_id,
            ),
        )
        .where(
            AvisoDB.instituicao_id == instituicao_id,
            _aviso_ativo_e_valido(),
        )
    )

    if not _usuario_eh_gestor(usuario_atual):
        base = base.where(
            or_(
                AvisoDB.destino_tipo == "todos",
                AvisoDestinatarioDB.usuario_id == usuario_id,
            )
        )

    total_visiveis_result = await db.execute(base)
    total_visiveis = total_visiveis_result.scalar() or 0

    nao_lidos_result = await db.execute(
        base.where(
            or_(
                AvisoDestinatarioDB.lido.is_(None),
                AvisoDestinatarioDB.lido == False,  # noqa: E712
            )
        )
    )
    total_nao_lidos = nao_lidos_result.scalar() or 0

    return AvisosResumoResponse(
        total_visiveis=total_visiveis,
        total_nao_lidos=total_nao_lidos,
        # Este campo deve alimentar o card "Alertas ativos" e o badge do sininho.
        total_alertas_ativos=total_nao_lidos,
    )


@router.get("/historico", response_model=AvisoHistoricoListResponse)
async def listar_historico_avisos(
    status_filtro: str = Query("baixados", pattern="^(ativos|baixados|todos)$"),
    busca: Optional[str] = None,
    classificacao: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limite: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = _instituicao_id(usuario_atual)

    if not _pode_consultar_historico_avisos(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil não tem permissão para consultar o histórico de avisos.",
        )

    agora = _agora_operacional_naive()

    consulta = select(AvisoDB).where(AvisoDB.instituicao_id == instituicao_id)
    consulta_total = select(func.count(AvisoDB.id)).where(AvisoDB.instituicao_id == instituicao_id)

    if status_filtro == "ativos":
        consulta = consulta.where(_aviso_ativo_e_valido())
        consulta_total = consulta_total.where(_aviso_ativo_e_valido())
    elif status_filtro == "baixados":
        filtro_baixados = or_(
            AvisoDB.ativo == False,  # noqa: E712
            AvisoDB.cancelado_em.is_not(None),
            and_(AvisoDB.valido_ate.is_not(None), AvisoDB.valido_ate < agora),
        )
        consulta = consulta.where(filtro_baixados)
        consulta_total = consulta_total.where(filtro_baixados)

    busca_limpa = (busca or "").strip()
    if busca_limpa:
        termo = f"%{busca_limpa}%"
        filtro_busca = or_(
            AvisoDB.titulo.ilike(termo),
            AvisoDB.mensagem.ilike(termo),
        )
        consulta = consulta.where(filtro_busca)
        consulta_total = consulta_total.where(filtro_busca)

    classificacao_limpa = (classificacao or "").strip()
    if classificacao_limpa:
        consulta = consulta.where(AvisoDB.classificacao == classificacao_limpa)
        consulta_total = consulta_total.where(AvisoDB.classificacao == classificacao_limpa)

    inicio = _parse_data_filtro(data_inicio)
    if inicio:
        consulta = consulta.where(AvisoDB.criado_em >= inicio)
        consulta_total = consulta_total.where(AvisoDB.criado_em >= inicio)

    fim = _parse_data_filtro(data_fim, fim_do_dia=True)
    if fim:
        consulta = consulta.where(AvisoDB.criado_em <= fim)
        consulta_total = consulta_total.where(AvisoDB.criado_em <= fim)

    total = (await db.execute(consulta_total)).scalar_one()

    resultado = await db.execute(
        consulta.order_by(AvisoDB.criado_em.desc()).offset(offset).limit(limite)
    )

    items = resultado.scalars().all()
    total_int = int(total or 0)

    return {
        "items": [_aviso_para_resposta(aviso, usuario_atual) for aviso in items],
        "total": total_int,
        "limit": limite,
        "offset": offset,
        "has_more": offset + limite < total_int,
    }


@router.patch("/{aviso_id}/lido")
async def marcar_aviso_como_lido(
    aviso_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    resultado_aviso = await db.execute(
        select(AvisoDB).where(
            AvisoDB.id == aviso_id,
            AvisoDB.instituicao_id == instituicao_id,
            _aviso_ativo_e_valido(),
        )
    )
    aviso = resultado_aviso.scalar_one_or_none()

    if not aviso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso não encontrado ou indisponível.",
        )

    if not await _usuario_pode_ver_aviso(db, aviso, usuario_id, instituicao_id, usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem acesso a este aviso.",
        )

    resultado_destinatario = await db.execute(
        select(AvisoDestinatarioDB).where(
            AvisoDestinatarioDB.aviso_id == aviso_id,
            AvisoDestinatarioDB.usuario_id == usuario_id,
        )
    )
    registro = resultado_destinatario.scalar_one_or_none()

    if not registro:
        registro = AvisoDestinatarioDB(
            aviso_id=aviso_id,
            usuario_id=usuario_id,
            lido=True,
            lido_em=_agora_operacional_naive(),
        )
        db.add(registro)
    else:
        registro.lido = True
        registro.lido_em = _agora_operacional_naive()

    await db.commit()

    return {"status": "sucesso", "mensagem": "Aviso marcado como lido."}


@router.patch("/{aviso_id}/nao-lido")
async def marcar_aviso_como_nao_lido(
    aviso_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    resultado_aviso = await db.execute(
        select(AvisoDB).where(
            AvisoDB.id == aviso_id,
            AvisoDB.instituicao_id == instituicao_id,
            _aviso_ativo_e_valido(),
        )
    )
    aviso = resultado_aviso.scalar_one_or_none()

    if not aviso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso não encontrado ou indisponível.",
        )

    if not await _usuario_pode_ver_aviso(db, aviso, usuario_id, instituicao_id, usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem acesso a este aviso.",
        )

    resultado_destinatario = await db.execute(
        select(AvisoDestinatarioDB).where(
            AvisoDestinatarioDB.aviso_id == aviso_id,
            AvisoDestinatarioDB.usuario_id == usuario_id,
        )
    )
    registro = resultado_destinatario.scalar_one_or_none()

    if not registro:
        registro = AvisoDestinatarioDB(
            aviso_id=aviso_id,
            usuario_id=usuario_id,
            lido=False,
            lido_em=None,
        )
        db.add(registro)
    else:
        registro.lido = False
        registro.lido_em = None

    await db.commit()

    return {"status": "sucesso", "mensagem": "Aviso marcado como não lido."}


@router.patch("/{aviso_id}", response_model=AvisoResponse)
async def atualizar_aviso(
    aviso_id: str,
    payload: AvisoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    if not _pode_gerenciar_avisos(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil não tem permissão para alterar avisos.",
        )

    resultado = await db.execute(
        select(AvisoDB).where(
            AvisoDB.id == aviso_id,
            AvisoDB.instituicao_id == instituicao_id,
        )
    )
    aviso = resultado.scalar_one_or_none()

    if not aviso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso não encontrado.",
        )

    dados = payload.model_dump(exclude_unset=True)

    novo_destino_tipo = dados.get("destino_tipo")
    if novo_destino_tipo is not None:
        novo_destino_tipo = novo_destino_tipo.strip().lower()
        if novo_destino_tipo not in {"todos", "usuarios"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='destino_tipo deve ser "todos" ou "usuarios".',
            )
        aviso.destino_tipo = novo_destino_tipo

    for campo in ["titulo", "mensagem", "classificacao", "prioridade", "ativo", "valido_ate"]:
        if campo in dados:
            valor = dados[campo]
            if isinstance(valor, str):
                valor = valor.strip()
            if campo == "prioridade" and isinstance(valor, str):
                valor = valor.lower()
            setattr(aviso, campo, valor)

    if "destinatarios_ids" in dados:
        destinatarios_ids = await _ids_destinatarios_validos(
            db,
            instituicao_id,
            dados.get("destinatarios_ids") or [],
        )

        await db.execute(
            AvisoDestinatarioDB.__table__.delete().where(
                AvisoDestinatarioDB.aviso_id == aviso_id
            )
        )

        if aviso.destino_tipo == "usuarios":
            if not destinatarios_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Informe ao menos um destinatário quando destino_tipo for "usuarios".',
                )

            for destinatario_id in destinatarios_ids:
                db.add(
                    AvisoDestinatarioDB(
                        aviso_id=aviso.id,
                        usuario_id=destinatario_id,
                    )
                )

    aviso.atualizado_em = _agora_operacional_naive()
    await db.commit()
    await db.refresh(aviso)

    return aviso


@router.delete("/{aviso_id}")
async def cancelar_aviso(
    aviso_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    if not _pode_gerenciar_avisos(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil não tem permissão para cancelar avisos.",
        )

    resultado = await db.execute(
        select(AvisoDB).where(
            AvisoDB.id == aviso_id,
            AvisoDB.instituicao_id == instituicao_id,
        )
    )
    aviso = resultado.scalar_one_or_none()

    if not aviso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso não encontrado.",
        )

    aviso.ativo = False
    aviso.cancelado_em = _agora_operacional_naive()
    aviso.cancelado_por_id = usuario_id

    await db.commit()

    return {"status": "sucesso", "mensagem": "Aviso cancelado com sucesso."}
