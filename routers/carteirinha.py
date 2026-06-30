"""Rotas de impressão oficial de carteirinha e log operacional."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from audit_log import registrar_evento_auditoria
from database import get_db
from models import CarteirinhaImpressaoLogDB, ConviventeDB, UsuarioDB
from routers.conviventes_helpers import agora_sao_paulo
from schemas import (
    CarteirinhaImpressaoLogItem,
    CarteirinhaImpressaoLogListaResponse,
    CarteirinhaImpressaoOficialCreate,
    CarteirinhaImpressaoOficialResponse,
    CarteirinhaImpressaoResumoPeriodo,
)
from security import bloquear_usuario_global_puro, get_usuario_logado
from tenant_scope import obter_instituicao_escopo
from time_operacional import parse_data_filtro_operacional

router = APIRouter(prefix="/api/carteirinha", tags=["Carteirinha"])


async def _nome_usuario(db: AsyncSession, usuario_id: str | None) -> str | None:
    if not usuario_id:
        return None
    usuario = (
        await db.execute(select(UsuarioDB).where(UsuarioDB.id == usuario_id))
    ).scalar_one_or_none()
    return usuario.nome if usuario else None


def _nome_convivente(convivente: ConviventeDB | None) -> str:
    if not convivente:
        return ""
    return convivente.nome_social or convivente.nome_completo or ""


async def _montar_item_log(
    db: AsyncSession,
    log: CarteirinhaImpressaoLogDB,
    convivente: ConviventeDB | None,
) -> CarteirinhaImpressaoLogItem:
    return CarteirinhaImpressaoLogItem(
        id=log.id,
        convivente_id=log.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        numero_institucional=(
            str(convivente.numero_institucional)
            if convivente and convivente.numero_institucional is not None
            else None
        ),
        usuario_id=log.usuario_id,
        usuario_nome=await _nome_usuario(db, log.usuario_id),
        quantidade=int(log.quantidade or 1),
        origem=str(log.origem or "unitaria"),
        impresso_em=log.impresso_em,
        total_acumulado_convivente=int(convivente.impressoes_carteirinha_oficiais or 0) if convivente else 0,
    )


@router.get("/impressoes-log", response_model=CarteirinhaImpressaoLogListaResponse)
async def listar_log_impressoes_carteirinha(
    data_inicio: str | None = None,
    data_fim: str | None = None,
    convivente_id: str | None = None,
    usuario_id: str | None = None,
    busca: str | None = None,
    limite: int = Query(50, ge=1, le=200),
    deslocamento: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    condicoes = [CarteirinhaImpressaoLogDB.instituicao_id == instituicao_id]

    if data_inicio:
        try:
            inicio = parse_data_filtro_operacional(data_inicio, fim_do_dia=False)
            condicoes.append(CarteirinhaImpressaoLogDB.impresso_em >= inicio)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data inicial inválida.")

    if data_fim:
        try:
            fim = parse_data_filtro_operacional(data_fim, fim_do_dia=True)
            condicoes.append(CarteirinhaImpressaoLogDB.impresso_em <= fim)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data final inválida.")

    if convivente_id:
        condicoes.append(CarteirinhaImpressaoLogDB.convivente_id == convivente_id)

    if usuario_id:
        condicoes.append(CarteirinhaImpressaoLogDB.usuario_id == usuario_id)

    termo_busca = (busca or "").strip()
    if termo_busca:
        like = f"%{termo_busca}%"
        condicoes.append(
            or_(
                ConviventeDB.nome_completo.ilike(like),
                ConviventeDB.nome_social.ilike(like),
                cast(ConviventeDB.numero_institucional, String).ilike(like),
                ConviventeDB.numero_sisa.ilike(like),
            )
        )

    base_query = (
        select(CarteirinhaImpressaoLogDB, ConviventeDB)
        .join(ConviventeDB, ConviventeDB.id == CarteirinhaImpressaoLogDB.convivente_id)
        .where(*condicoes)
    )

    total = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar_one()

    resumo_row = (
        await db.execute(
            select(
                func.count(CarteirinhaImpressaoLogDB.id),
                func.coalesce(func.sum(CarteirinhaImpressaoLogDB.quantidade), 0),
                func.count(func.distinct(CarteirinhaImpressaoLogDB.convivente_id)),
            )
            .select_from(CarteirinhaImpressaoLogDB)
            .join(ConviventeDB, ConviventeDB.id == CarteirinhaImpressaoLogDB.convivente_id)
            .where(*condicoes)
        )
    ).one()

    rows = (
        await db.execute(
            base_query
            .order_by(CarteirinhaImpressaoLogDB.impresso_em.desc())
            .offset(deslocamento)
            .limit(limite)
        )
    ).all()

    items: list[CarteirinhaImpressaoLogItem] = []
    for log, convivente in rows:
        items.append(await _montar_item_log(db, log, convivente))

    total_int = int(total or 0)
    return CarteirinhaImpressaoLogListaResponse(
        items=items,
        total=total_int,
        limit=limite,
        offset=deslocamento,
        has_more=(deslocamento + len(items)) < total_int,
        resumo=CarteirinhaImpressaoResumoPeriodo(
            total_eventos=int(resumo_row[0] or 0),
            total_carteirinhas=int(resumo_row[1] or 0),
            conviventes_distintos=int(resumo_row[2] or 0),
        ),
    )


@router.post(
    "/conviventes/{convivente_id}/impressao-oficial",
    response_model=CarteirinhaImpressaoOficialResponse,
)
async def registrar_impressao_carteirinha_oficial(
    convivente_id: str,
    payload: CarteirinhaImpressaoOficialCreate | None = None,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    bloquear_usuario_global_puro(usuario_atual)
    dados = payload or CarteirinhaImpressaoOficialCreate()
    quantidade = int(dados.quantidade)
    origem = dados.origem

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == convivente_id,
                ConviventeDB.instituicao_id == obter_instituicao_escopo(usuario_atual),
            )
        )
    ).scalar_one_or_none()
    if not convivente:
        raise HTTPException(status_code=404, detail="Convivente não encontrado.")

    agora = agora_sao_paulo()
    convivente.impressoes_carteirinha_oficiais = int(convivente.impressoes_carteirinha_oficiais or 0) + quantidade

    log = CarteirinhaImpressaoLogDB(
        instituicao_id=obter_instituicao_escopo(usuario_atual),
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        quantidade=quantidade,
        origem=origem,
        impresso_em=agora,
    )
    db.add(log)
    await db.commit()
    await db.refresh(convivente)
    await db.refresh(log)

    registrar_evento_auditoria(
        "carteirinha_impressao_oficial",
        usuario_atual=usuario_atual,
        convivente_id=convivente.id,
        quantidade=quantidade,
        origem=origem,
        log_id=log.id,
    )

    return CarteirinhaImpressaoOficialResponse(
        convivente_id=convivente.id,
        impressoes_carteirinha_oficiais=convivente.impressoes_carteirinha_oficiais,
        log_id=log.id,
        quantidade=quantidade,
        origem=origem,
        impresso_em=log.impresso_em,
    )
