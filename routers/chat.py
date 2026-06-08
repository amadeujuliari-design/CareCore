from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ChatConversaDB, ChatMensagemDB, ChatParticipanteDB, UsuarioDB
from schemas import (
    ChatConversaCreate,
    ChatConversaResponse,
    ChatMensagemCreate,
    ChatMensagemResponse,
    ChatMensagensListResponse,
    ChatResumoResponse,
    ChatUsuarioResponse,
)
from security import get_usuario_logado


router = APIRouter(prefix="/api/chat", tags=["Chat Interno"])
MAX_PARTICIPANTES_GRUPO = 15


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


def _agora() -> datetime:
    return datetime.utcnow()


async def _obter_participacao(
    db: AsyncSession,
    conversa_id: str,
    usuario_id: str,
    instituicao_id: str,
) -> ChatParticipanteDB:
    resultado = await db.execute(
        select(ChatParticipanteDB).where(
            ChatParticipanteDB.conversa_id == conversa_id,
            ChatParticipanteDB.usuario_id == usuario_id,
            ChatParticipanteDB.instituicao_id == instituicao_id,
            ChatParticipanteDB.ativo == True,  # noqa: E712
        )
    )
    participacao = resultado.scalar_one_or_none()

    if not participacao:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa desta conversa.",
        )

    return participacao


async def _buscar_usuarios_por_ids(
    db: AsyncSession,
    instituicao_id: str,
    usuarios_ids: List[str],
) -> Dict[str, UsuarioDB]:
    ids = list(dict.fromkeys([usuario_id for usuario_id in usuarios_ids if usuario_id]))

    if not ids:
        return {}

    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.instituicao_id == instituicao_id,
            UsuarioDB.id.in_(ids),
        )
    )

    return {usuario.id: usuario for usuario in resultado.scalars().all()}


def _usuario_para_chat_response(usuario: UsuarioDB) -> ChatUsuarioResponse:
    return ChatUsuarioResponse(
        id=usuario.id,
        nome=usuario.nome,
        email=usuario.email,
        perfil_acesso=usuario.perfil_acesso,
        avatar_url=usuario.avatar_url,
        cargo=usuario.cargo,
        setor=usuario.setor,
    )


async def _contar_nao_lidas(
    db: AsyncSession,
    conversa_id: str,
    usuario_id: str,
    ultimo_lido_em: Optional[datetime],
) -> int:
    filtros = [
        ChatMensagemDB.conversa_id == conversa_id,
        ChatMensagemDB.remetente_id != usuario_id,
    ]

    if ultimo_lido_em:
        filtros.append(ChatMensagemDB.criado_em > ultimo_lido_em)

    resultado = await db.execute(select(func.count(ChatMensagemDB.id)).where(*filtros))
    return int(resultado.scalar_one() or 0)


async def _ultima_mensagem(
    db: AsyncSession,
    conversa_id: str,
    usuario_id: str,
) -> Optional[ChatMensagemResponse]:
    resultado = await db.execute(
        select(ChatMensagemDB)
        .where(ChatMensagemDB.conversa_id == conversa_id)
        .order_by(ChatMensagemDB.criado_em.desc())
        .limit(1)
    )
    mensagem = resultado.scalar_one_or_none()

    if not mensagem:
        return None

    usuarios = await _buscar_usuarios_por_ids(db, mensagem.instituicao_id, [mensagem.remetente_id])
    remetente = usuarios.get(mensagem.remetente_id)

    return ChatMensagemResponse(
        id=mensagem.id,
        conversa_id=mensagem.conversa_id,
        remetente_id=mensagem.remetente_id,
        remetente_nome=remetente.nome if remetente else None,
        conteudo=mensagem.conteudo,
        criado_em=mensagem.criado_em,
        enviada_por_mim=mensagem.remetente_id == usuario_id,
    )


async def _conversa_para_response(
    db: AsyncSession,
    conversa: ChatConversaDB,
    participacao: ChatParticipanteDB,
    usuario_id: str,
) -> ChatConversaResponse:
    resultado_participantes = await db.execute(
        select(ChatParticipanteDB).where(
            ChatParticipanteDB.conversa_id == conversa.id,
            ChatParticipanteDB.ativo == True,  # noqa: E712
        )
    )
    participantes = resultado_participantes.scalars().all()
    usuarios = await _buscar_usuarios_por_ids(
        db,
        conversa.instituicao_id,
        [participante.usuario_id for participante in participantes],
    )

    return ChatConversaResponse(
        id=conversa.id,
        tipo=conversa.tipo,
        titulo=conversa.titulo,
        participantes=[
            _usuario_para_chat_response(usuario)
            for usuario in usuarios.values()
        ],
        ultima_mensagem=await _ultima_mensagem(db, conversa.id, usuario_id),
        nao_lidas=await _contar_nao_lidas(
            db,
            conversa.id,
            usuario_id,
            participacao.ultimo_lido_em,
        ),
        atualizado_em=conversa.atualizado_em or conversa.criado_em,
    )


def _mensagem_para_response(
    mensagem: ChatMensagemDB,
    usuario_id: str,
    usuarios: Dict[str, UsuarioDB],
) -> ChatMensagemResponse:
    remetente = usuarios.get(mensagem.remetente_id)

    return ChatMensagemResponse(
        id=mensagem.id,
        conversa_id=mensagem.conversa_id,
        remetente_id=mensagem.remetente_id,
        remetente_nome=remetente.nome if remetente else None,
        conteudo=mensagem.conteudo,
        criado_em=mensagem.criado_em,
        enviada_por_mim=mensagem.remetente_id == usuario_id,
    )


async def _buscar_conversa_direta_existente(
    db: AsyncSession,
    instituicao_id: str,
    usuario_id: str,
    outro_usuario_id: str,
) -> Optional[ChatConversaDB]:
    conversas_usuario = select(ChatParticipanteDB.conversa_id).where(
        ChatParticipanteDB.instituicao_id == instituicao_id,
        ChatParticipanteDB.usuario_id == usuario_id,
        ChatParticipanteDB.ativo == True,  # noqa: E712
    )
    conversas_outro = select(ChatParticipanteDB.conversa_id).where(
        ChatParticipanteDB.instituicao_id == instituicao_id,
        ChatParticipanteDB.usuario_id == outro_usuario_id,
        ChatParticipanteDB.ativo == True,  # noqa: E712
    )

    resultado = await db.execute(
        select(ChatConversaDB)
        .where(
            ChatConversaDB.instituicao_id == instituicao_id,
            ChatConversaDB.tipo == "direta",
            ChatConversaDB.id.in_(conversas_usuario),
            ChatConversaDB.id.in_(conversas_outro),
        )
        .order_by(ChatConversaDB.atualizado_em.desc())
    )

    for conversa in resultado.scalars().all():
        total_resultado = await db.execute(
            select(func.count(ChatParticipanteDB.id)).where(
                ChatParticipanteDB.conversa_id == conversa.id,
                ChatParticipanteDB.ativo == True,  # noqa: E712
            )
        )

        if int(total_resultado.scalar_one() or 0) == 2:
            return conversa

    return None


@router.get("/usuarios", response_model=List[ChatUsuarioResponse])
async def listar_usuarios_chat(
    busca: Optional[str] = None,
    limite: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    filtros = [
        UsuarioDB.instituicao_id == instituicao_id,
        UsuarioDB.ativo == True,  # noqa: E712
        UsuarioDB.id != usuario_id,
    ]

    busca_limpa = (busca or "").strip()
    if busca_limpa:
        termo = f"%{busca_limpa}%"
        filtros.append(
            or_(
                UsuarioDB.nome.ilike(termo),
                UsuarioDB.email.ilike(termo),
                UsuarioDB.perfil_acesso.ilike(termo),
            )
        )

    resultado = await db.execute(
        select(UsuarioDB)
        .where(*filtros)
        .order_by(UsuarioDB.nome.asc())
        .limit(limite)
    )

    return [_usuario_para_chat_response(usuario) for usuario in resultado.scalars().all()]


@router.get("/resumo", response_model=ChatResumoResponse)
async def obter_resumo_chat(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    total_conversas = (
        await db.execute(
            select(func.count(ChatParticipanteDB.id)).where(
                ChatParticipanteDB.instituicao_id == instituicao_id,
                ChatParticipanteDB.usuario_id == usuario_id,
                ChatParticipanteDB.ativo == True,  # noqa: E712
            )
        )
    ).scalar_one()

    total_nao_lidas = (
        await db.execute(
            select(func.count(ChatMensagemDB.id))
            .join(
                ChatParticipanteDB,
                and_(
                    ChatParticipanteDB.conversa_id == ChatMensagemDB.conversa_id,
                    ChatParticipanteDB.instituicao_id == ChatMensagemDB.instituicao_id,
                    ChatParticipanteDB.usuario_id == usuario_id,
                    ChatParticipanteDB.ativo == True,  # noqa: E712
                ),
            )
            .where(
                ChatMensagemDB.instituicao_id == instituicao_id,
                ChatMensagemDB.remetente_id != usuario_id,
                or_(
                    ChatParticipanteDB.ultimo_lido_em.is_(None),
                    ChatMensagemDB.criado_em > ChatParticipanteDB.ultimo_lido_em,
                ),
            )
        )
    ).scalar_one()

    return {
        "total_nao_lidas": int(total_nao_lidas or 0),
        "total_conversas": int(total_conversas or 0),
    }


@router.get("/conversas", response_model=List[ChatConversaResponse])
async def listar_conversas(
    limite: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)

    resultado = await db.execute(
        select(ChatConversaDB, ChatParticipanteDB)
        .join(
            ChatParticipanteDB,
            and_(
                ChatParticipanteDB.conversa_id == ChatConversaDB.id,
                ChatParticipanteDB.usuario_id == usuario_id,
                ChatParticipanteDB.ativo == True,  # noqa: E712
            ),
        )
        .where(ChatConversaDB.instituicao_id == instituicao_id)
        .order_by(ChatConversaDB.atualizado_em.desc())
        .offset(offset)
        .limit(limite)
    )

    linhas = resultado.all()
    if not linhas:
        return []

    conversas = [conversa for conversa, _participacao in linhas]
    conversas_ids = [conversa.id for conversa in conversas]

    resultado_participantes = await db.execute(
        select(ChatParticipanteDB).where(
            ChatParticipanteDB.instituicao_id == instituicao_id,
            ChatParticipanteDB.conversa_id.in_(conversas_ids),
            ChatParticipanteDB.ativo == True,  # noqa: E712
        )
    )
    participantes = resultado_participantes.scalars().all()

    usuarios = await _buscar_usuarios_por_ids(
        db,
        instituicao_id,
        list({participante.usuario_id for participante in participantes}),
    )

    participantes_por_conversa: Dict[str, List[ChatParticipanteDB]] = {}
    for participante in participantes:
        participantes_por_conversa.setdefault(participante.conversa_id, []).append(participante)

    ultimas_subquery = (
        select(
            ChatMensagemDB.id.label("id"),
            func.row_number()
            .over(
                partition_by=ChatMensagemDB.conversa_id,
                order_by=ChatMensagemDB.criado_em.desc(),
            )
            .label("ordem"),
        )
        .where(ChatMensagemDB.conversa_id.in_(conversas_ids))
        .subquery()
    )
    resultado_ultimas = await db.execute(
        select(ChatMensagemDB)
        .join(ultimas_subquery, ChatMensagemDB.id == ultimas_subquery.c.id)
        .where(ultimas_subquery.c.ordem == 1)
    )
    ultimas_mensagens = {
        mensagem.conversa_id: mensagem
        for mensagem in resultado_ultimas.scalars().all()
    }

    remetentes_ids = {
        mensagem.remetente_id
        for mensagem in ultimas_mensagens.values()
    }
    usuarios.update(await _buscar_usuarios_por_ids(db, instituicao_id, list(remetentes_ids)))

    resultado_nao_lidas = await db.execute(
        select(ChatMensagemDB.conversa_id, func.count(ChatMensagemDB.id))
        .join(
            ChatParticipanteDB,
            and_(
                ChatParticipanteDB.conversa_id == ChatMensagemDB.conversa_id,
                ChatParticipanteDB.instituicao_id == ChatMensagemDB.instituicao_id,
                ChatParticipanteDB.usuario_id == usuario_id,
                ChatParticipanteDB.ativo == True,  # noqa: E712
            ),
        )
        .where(
            ChatMensagemDB.instituicao_id == instituicao_id,
            ChatMensagemDB.conversa_id.in_(conversas_ids),
            ChatMensagemDB.remetente_id != usuario_id,
            or_(
                ChatParticipanteDB.ultimo_lido_em.is_(None),
                ChatMensagemDB.criado_em > ChatParticipanteDB.ultimo_lido_em,
            ),
        )
        .group_by(ChatMensagemDB.conversa_id)
    )
    nao_lidas_por_conversa = {
        conversa_id: int(total or 0)
        for conversa_id, total in resultado_nao_lidas.all()
    }

    respostas = []
    for conversa in conversas:
        ultima = ultimas_mensagens.get(conversa.id)
        participantes_resposta = [
            _usuario_para_chat_response(usuarios[participante.usuario_id])
            for participante in participantes_por_conversa.get(conversa.id, [])
            if participante.usuario_id in usuarios
        ]

        respostas.append(
            ChatConversaResponse(
                id=conversa.id,
                tipo=conversa.tipo,
                titulo=conversa.titulo,
                participantes=participantes_resposta,
                ultima_mensagem=_mensagem_para_response(ultima, usuario_id, usuarios)
                if ultima
                else None,
                nao_lidas=nao_lidas_por_conversa.get(conversa.id, 0),
                atualizado_em=conversa.atualizado_em or conversa.criado_em,
            )
        )

    return respostas


@router.post("/conversas", response_model=ChatConversaResponse, status_code=status.HTTP_201_CREATED)
async def criar_conversa(
    payload: ChatConversaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)
    participantes_ids = list(dict.fromkeys([
        participante_id
        for participante_id in payload.participantes_ids
        if participante_id and participante_id != usuario_id
    ]))

    if not participantes_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione ao menos um usuário para iniciar a conversa.",
        )

    total_participantes = len(participantes_ids) + 1
    if total_participantes > MAX_PARTICIPANTES_GRUPO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Conversas em grupo podem ter no máximo {MAX_PARTICIPANTES_GRUPO} participantes.",
        )

    usuarios = await _buscar_usuarios_por_ids(db, instituicao_id, participantes_ids)
    usuarios_ativos = {
        usuario.id: usuario
        for usuario in usuarios.values()
        if usuario.ativo
    }

    if len(usuarios_ativos) != len(participantes_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Um ou mais usuários selecionados não estão ativos neste projeto.",
        )

    if len(participantes_ids) == 1:
        conversa_existente = await _buscar_conversa_direta_existente(
            db,
            instituicao_id,
            usuario_id,
            participantes_ids[0],
        )

        if conversa_existente:
            participacao = await _obter_participacao(
                db,
                conversa_existente.id,
                usuario_id,
                instituicao_id,
            )
            return await _conversa_para_response(db, conversa_existente, participacao, usuario_id)

    titulo_limpo = (payload.titulo or "").strip()
    if len(participantes_ids) > 1 and not titulo_limpo:
        titulo_limpo = f"Grupo com {total_participantes} participantes"

    agora = _agora()
    conversa = ChatConversaDB(
        instituicao_id=instituicao_id,
        tipo="direta" if len(participantes_ids) == 1 else "grupo",
        titulo=titulo_limpo or None,
        criado_por_id=usuario_id,
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(conversa)
    await db.flush()

    for participante_id in [usuario_id, *participantes_ids]:
        db.add(
            ChatParticipanteDB(
                conversa_id=conversa.id,
                usuario_id=participante_id,
                instituicao_id=instituicao_id,
                ativo=True,
                ultimo_lido_em=agora if participante_id == usuario_id else None,
                criado_em=agora,
            )
        )

    await db.commit()
    await db.refresh(conversa)

    participacao = await _obter_participacao(db, conversa.id, usuario_id, instituicao_id)
    return await _conversa_para_response(db, conversa, participacao, usuario_id)


@router.get("/conversas/{conversa_id}/mensagens", response_model=ChatMensagensListResponse)
async def listar_mensagens(
    conversa_id: str,
    limite: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)
    participacao = await _obter_participacao(db, conversa_id, usuario_id, instituicao_id)

    total_resultado = await db.execute(
        select(func.count(ChatMensagemDB.id)).where(
            ChatMensagemDB.conversa_id == conversa_id,
            ChatMensagemDB.instituicao_id == instituicao_id,
        )
    )
    total = int(total_resultado.scalar_one() or 0)

    resultado = await db.execute(
        select(ChatMensagemDB)
        .where(
            ChatMensagemDB.conversa_id == conversa_id,
            ChatMensagemDB.instituicao_id == instituicao_id,
        )
        .order_by(ChatMensagemDB.criado_em.desc())
        .offset(offset)
        .limit(limite)
    )
    mensagens = list(reversed(resultado.scalars().all()))
    usuarios = await _buscar_usuarios_por_ids(
        db,
        instituicao_id,
        [mensagem.remetente_id for mensagem in mensagens],
    )

    ultima_data = max([mensagem.criado_em for mensagem in mensagens], default=None)
    if ultima_data and (
        participacao.ultimo_lido_em is None
        or ultima_data > participacao.ultimo_lido_em
    ):
        participacao.ultimo_lido_em = _agora()
        await db.commit()

    return {
        "items": [
            _mensagem_para_response(mensagem, usuario_id, usuarios)
            for mensagem in mensagens
        ],
        "total": total,
        "limit": limite,
        "offset": offset,
        "has_more": offset + limite < total,
    }


@router.post("/conversas/{conversa_id}/mensagens", response_model=ChatMensagemResponse, status_code=status.HTTP_201_CREATED)
async def enviar_mensagem(
    conversa_id: str,
    payload: ChatMensagemCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = _usuario_id(usuario_atual)
    instituicao_id = _instituicao_id(usuario_atual)
    await _obter_participacao(db, conversa_id, usuario_id, instituicao_id)

    resultado_conversa = await db.execute(
        select(ChatConversaDB).where(
            ChatConversaDB.id == conversa_id,
            ChatConversaDB.instituicao_id == instituicao_id,
        )
    )
    conversa = resultado_conversa.scalar_one_or_none()

    if not conversa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada.")

    agora = _agora()
    mensagem = ChatMensagemDB(
        conversa_id=conversa_id,
        instituicao_id=instituicao_id,
        remetente_id=usuario_id,
        conteudo=payload.conteudo.strip(),
        criado_em=agora,
    )
    conversa.atualizado_em = agora

    db.add(mensagem)
    await db.commit()
    await db.refresh(mensagem)

    return ChatMensagemResponse(
        id=mensagem.id,
        conversa_id=mensagem.conversa_id,
        remetente_id=mensagem.remetente_id,
        remetente_nome=usuario_atual.get("nome"),
        conteudo=mensagem.conteudo,
        criado_em=mensagem.criado_em,
        enviada_por_mim=True,
    )
