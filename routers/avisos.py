# =====================================================================
# ARQUIVO: routers/avisos.py
# =====================================================================
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AvisoDB, AvisoDestinatarioDB, UsuarioDB
from schemas import (
    AvisoCreate,
    AvisoDashboardResponse,
    AvisoResponse,
    AvisosResumoResponse,
    AvisoUpdate,
)
from security import get_usuario_logado

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


def _aviso_ativo_e_valido():
    agora = datetime.utcnow()
    return and_(
        AvisoDB.ativo == True,  # noqa: E712
        AvisoDB.cancelado_em.is_(None),
        or_(AvisoDB.valido_ate.is_(None), AvisoDB.valido_ate >= agora),
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
        classificacao=(payload.classificacao or "Informativo").strip(),
        prioridade=(payload.prioridade or "normal").strip().lower(),
        destino_tipo=destino_tipo,
        ativo=payload.ativo,
        valido_ate=payload.valido_ate,
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

    return novo_aviso


@router.get("/me", response_model=List[AvisoDashboardResponse])
async def listar_meus_avisos(
    somente_nao_lidos: bool = False,
    limite: int = 10,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    limite = max(1, min(limite, 50))

    consulta = (
        select(AvisoDB, UsuarioDB.nome, UsuarioDB.avatar_url, AvisoDestinatarioDB.lido, AvisoDestinatarioDB.lido_em)
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

    consulta = consulta.order_by(AvisoDB.criado_em.desc()).limit(limite)

    if somente_nao_lidos:
        consulta = consulta.where(
            or_(
                AvisoDestinatarioDB.lido.is_(None),
                AvisoDestinatarioDB.lido == False,  # noqa: E712
            )
        )

    resultado = await db.execute(consulta)

    avisos = []
    for aviso, remetente_nome, remetente_avatar_url, lido, lido_em in resultado.all():
        lido_bool = bool(lido)
        pode_exibir_titulo = aviso.destino_tipo == "todos" or _usuario_eh_gestor(usuario_atual)

        avisos.append(
            AvisoDashboardResponse(
                id=aviso.id,
                remetente_id=aviso.remetente_id,
                remetente_nome=remetente_nome,
                remetente_avatar_url=remetente_avatar_url,
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
            )
        )

    return avisos


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
            lido_em=datetime.utcnow(),
        )
        db.add(registro)
    else:
        registro.lido = True
        registro.lido_em = datetime.utcnow()

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

    aviso.atualizado_em = datetime.utcnow()
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
    aviso.cancelado_em = datetime.utcnow()
    aviso.cancelado_por_id = usuario_id

    await db.commit()

    return {"status": "sucesso", "mensagem": "Aviso cancelado com sucesso."}
