"""Reserva atomica de lotes de cupons NFP para o robo (fatias de 100)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import NfpCupomLidoDB
from time_operacional import agora_operacional_naive

STATUS_PENDENTE = "pendente"
STATUS_RESERVADO = "reservado"
TAMANHO_LOTE_PADRAO = 100
TTL_RESERVA_MINUTOS = 45


def _run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


async def liberar_reservas_expiradas(
    db: AsyncSession,
    organizacao_id: str,
    *,
    ttl_minutos: int = TTL_RESERVA_MINUTOS,
) -> int:
    limite = agora_operacional_naive() - timedelta(minutes=max(1, int(ttl_minutos)))
    res = await db.execute(
        update(NfpCupomLidoDB)
        .where(
            NfpCupomLidoDB.organizacao_id == organizacao_id,
            NfpCupomLidoDB.status == STATUS_RESERVADO,
            NfpCupomLidoDB.reservado_em.is_not(None),
            NfpCupomLidoDB.reservado_em < limite,
        )
        .values(
            status=STATUS_PENDENTE,
            lote_id=None,
            reservado_em=None,
            reservado_por=None,
            atualizado_em=agora_operacional_naive(),
            mensagem="Reserva expirada — liberado para outra maquina.",
        )
    )
    await db.commit()
    return int(res.rowcount or 0)


async def reservar_lote_cupons(
    db: AsyncSession,
    *,
    organizacao_id: str,
    usuario_id: Optional[str],
    tamanho: int = TAMANHO_LOTE_PADRAO,
) -> dict[str, Any]:
    """Reserva ate `tamanho` pendentes (FIFO). Retorna lote_id + chaves."""
    qtd = max(1, min(int(tamanho or TAMANHO_LOTE_PADRAO), TAMANHO_LOTE_PADRAO))
    await liberar_reservas_expiradas(db, organizacao_id)

    stmt = (
        select(NfpCupomLidoDB)
        .where(
            NfpCupomLidoDB.organizacao_id == organizacao_id,
            NfpCupomLidoDB.status == STATUS_PENDENTE,
        )
        .order_by(NfpCupomLidoDB.lido_em.asc())
        .limit(qtd)
    )
    conn = await db.connection()
    if getattr(conn.dialect, "name", "") == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)

    rows = (await db.execute(stmt)).scalars().all()

    if not rows:
        return {"lote_id": None, "chaves": [], "qtd": 0}

    lote_id = str(uuid.uuid4())
    agora = agora_operacional_naive()
    chaves: list[str] = []
    for row in rows:
        row.status = STATUS_RESERVADO
        row.lote_id = lote_id
        row.reservado_em = agora
        row.reservado_por = usuario_id or None
        row.atualizado_em = agora
        row.mensagem = f"Reservado para envio SEFAZ (lote {lote_id[:8]}…)."
        chaves.append(row.chave)
    await db.commit()
    return {"lote_id": lote_id, "chaves": chaves, "qtd": len(chaves)}


async def liberar_lote(
    db: AsyncSession,
    *,
    organizacao_id: str,
    lote_id: str,
    apenas_reservados: bool = True,
) -> int:
    if not lote_id:
        return 0
    filtros = [
        NfpCupomLidoDB.organizacao_id == organizacao_id,
        NfpCupomLidoDB.lote_id == lote_id,
    ]
    if apenas_reservados:
        filtros.append(NfpCupomLidoDB.status == STATUS_RESERVADO)
    res = await db.execute(
        update(NfpCupomLidoDB)
        .where(*filtros)
        .values(
            status=STATUS_PENDENTE,
            lote_id=None,
            reservado_em=None,
            reservado_por=None,
            atualizado_em=agora_operacional_naive(),
            mensagem="Reserva liberada (parada ou fim de lote).",
        )
    )
    await db.commit()
    return int(res.rowcount or 0)


def liberar_reservas_expiradas_sync(organizacao_id: str) -> int:
    async def _run():
        async with AsyncSessionLocal() as db:
            return await liberar_reservas_expiradas(db, organizacao_id)

    return _run_async(_run())


def reservar_lote_cupons_sync(
    *,
    organizacao_id: str,
    usuario_id: Optional[str],
    tamanho: int = TAMANHO_LOTE_PADRAO,
) -> dict[str, Any]:
    async def _run():
        async with AsyncSessionLocal() as db:
            return await reservar_lote_cupons(
                db,
                organizacao_id=organizacao_id,
                usuario_id=usuario_id,
                tamanho=tamanho,
            )

    return _run_async(_run())


def liberar_lote_sync(*, organizacao_id: str, lote_id: str) -> int:
    async def _run():
        async with AsyncSessionLocal() as db:
            return await liberar_lote(db, organizacao_id=organizacao_id, lote_id=lote_id)

    return _run_async(_run())


async def aplicar_resultados_envio(
    db: AsyncSession,
    *,
    organizacao_id: str,
    itens: list[dict[str, Any]],
) -> int:
    """Atualiza cupons pelo retorno do robo (chave + status_carecore/tipo)."""
    if not itens:
        return 0
    atualizados = 0
    agora = agora_operacional_naive()
    for item in itens:
        chave = "".join(ch for ch in str(item.get("chave") or "") if ch.isdigit())
        if len(chave) != 44:
            continue
        status_cc = (item.get("status_carecore") or "").strip().lower()
        tipo = (item.get("tipo") or "").strip().lower()
        if status_cc not in {"enviado", "erro", "pendente", "rejeitado_prazo"}:
            if tipo in {"sucesso", "ja_existe"}:
                status_cc = "enviado"
            elif tipo == "erro":
                status_cc = "erro"
            else:
                continue
        row = (
            await db.execute(
                select(NfpCupomLidoDB).where(
                    NfpCupomLidoDB.organizacao_id == organizacao_id,
                    NfpCupomLidoDB.chave == chave,
                )
            )
        ).scalar_one_or_none()
        if not row:
            continue
        row.status = status_cc
        row.mensagem = (item.get("mensagem") or row.mensagem or "")[:2000] or row.mensagem
        row.atualizado_em = agora
        if status_cc == "enviado":
            row.enviado_em = agora
        row.lote_id = None
        row.reservado_em = None
        row.reservado_por = None
        atualizados += 1
    await db.commit()
    return atualizados
