"""Pontuação cumulativa por presença em atividades e resgate de brindes."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import String, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import AtividadePontosResgateDB, AtividadePresencaDB, ConviventeDB

PONTOS_POR_PRESENCA_ATIVIDADE = 10
STATUS_CONVIVENTE_PONTOS = {"Ativo", "Em acolhimento"}


@dataclass
class SaldoPontosConvivente:
    convivente_id: str
    total_presencas: int
    pontos_ganhos: int
    pontos_utilizados: int
    saldo_pontos: int


async def _contar_presencas_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> int:
    total = await db.scalar(
        select(func.count(AtividadePresencaDB.id)).where(
            AtividadePresencaDB.instituicao_id == instituicao_id,
            AtividadePresencaDB.convivente_id == convivente_id,
            AtividadePresencaDB.cancelado.is_(False),
        )
    )
    return int(total or 0)


async def _somar_pontos_utilizados_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> int:
    total = await db.scalar(
        select(func.coalesce(func.sum(AtividadePontosResgateDB.pontos_utilizados), 0)).where(
            AtividadePontosResgateDB.instituicao_id == instituicao_id,
            AtividadePontosResgateDB.convivente_id == convivente_id,
        )
    )
    return int(total or 0)


def _montar_saldo(convivente_id: str, total_presencas: int, pontos_utilizados: int) -> SaldoPontosConvivente:
    pontos_ganhos = total_presencas * PONTOS_POR_PRESENCA_ATIVIDADE
    return SaldoPontosConvivente(
        convivente_id=convivente_id,
        total_presencas=total_presencas,
        pontos_ganhos=pontos_ganhos,
        pontos_utilizados=pontos_utilizados,
        saldo_pontos=pontos_ganhos - pontos_utilizados,
    )


async def calcular_saldo_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> SaldoPontosConvivente:
    total_presencas = await _contar_presencas_convivente(db, instituicao_id, convivente_id)
    pontos_utilizados = await _somar_pontos_utilizados_convivente(db, instituicao_id, convivente_id)
    return _montar_saldo(convivente_id, total_presencas, pontos_utilizados)


async def montar_ranking_pontos(
    db: AsyncSession,
    instituicao_id: str,
    *,
    busca: str | None = None,
    somente_com_saldo: bool = False,
) -> list[dict]:
    presencas_subq = (
        select(
            AtividadePresencaDB.convivente_id.label("convivente_id"),
            func.count(AtividadePresencaDB.id).label("total_presencas"),
        )
        .where(
            AtividadePresencaDB.instituicao_id == instituicao_id,
            AtividadePresencaDB.cancelado.is_(False),
        )
        .group_by(AtividadePresencaDB.convivente_id)
        .subquery()
    )

    resgates_subq = (
        select(
            AtividadePontosResgateDB.convivente_id.label("convivente_id"),
            func.coalesce(func.sum(AtividadePontosResgateDB.pontos_utilizados), 0).label("pontos_utilizados"),
        )
        .where(AtividadePontosResgateDB.instituicao_id == instituicao_id)
        .group_by(AtividadePontosResgateDB.convivente_id)
        .subquery()
    )

    query = (
        select(
            ConviventeDB,
            func.coalesce(presencas_subq.c.total_presencas, 0).label("total_presencas"),
            func.coalesce(resgates_subq.c.pontos_utilizados, 0).label("pontos_utilizados"),
        )
        .outerjoin(presencas_subq, ConviventeDB.id == presencas_subq.c.convivente_id)
        .outerjoin(resgates_subq, ConviventeDB.id == resgates_subq.c.convivente_id)
        .where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.status.in_(STATUS_CONVIVENTE_PONTOS),
        )
        .order_by(ConviventeDB.nome_completo.asc())
    )

    if busca:
        termo = f"%{busca.strip()}%"
        query = query.where(
            ConviventeDB.nome_completo.ilike(termo)
            | ConviventeDB.nome_social.ilike(termo)
            | func.cast(ConviventeDB.numero_institucional, String).ilike(termo)
        )

    rows = (await db.execute(query)).all()
    itens: list[dict] = []

    for convivente, total_presencas, pontos_utilizados in rows:
        saldo = _montar_saldo(
            convivente.id,
            int(total_presencas or 0),
            int(pontos_utilizados or 0),
        )
        if somente_com_saldo and saldo.saldo_pontos <= 0 and saldo.total_presencas <= 0:
            continue
        itens.append(
            {
                "convivente": convivente,
                "total_presencas": saldo.total_presencas,
                "pontos_ganhos": saldo.pontos_ganhos,
                "pontos_utilizados": saldo.pontos_utilizados,
                "saldo_pontos": saldo.saldo_pontos,
            }
        )

    itens.sort(
        key=lambda item: (
            -item["saldo_pontos"],
            -item["total_presencas"],
            (item["convivente"].nome_completo or "").lower(),
        )
    )

    for posicao, item in enumerate(itens, start=1):
        item["posicao"] = posicao

    return itens
