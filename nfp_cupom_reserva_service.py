"""Reserva atomica de lotes de cupons NFP para o robo (fatias de 100)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import NfpCupomLidoDB
from nfp_conferencia_sefaz_service import parse_sefaz_registrado_em
from nfp_cupom_utils import mensagem_chave_invalida, validar_chave_acesso_nfe
from nfp_utils import limpar_nota
from time_operacional import agora_operacional_naive

STATUS_PENDENTE = "pendente"
STATUS_RESERVADO = "reservado"
STATUS_ERRO = "erro"
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
    """Reserva ate `tamanho` pendentes (FIFO). Retorna lote_id + chaves.

    Chaves estruturalmente invalidas sao marcadas como erro e nao entram no lote.
    """
    qtd = max(1, min(int(tamanho or TAMANHO_LOTE_PADRAO), TAMANHO_LOTE_PADRAO))
    await liberar_reservas_expiradas(db, organizacao_id)

    lote_id = str(uuid.uuid4())
    agora = agora_operacional_naive()
    chaves: list[str] = []
    restantes = qtd
    # Busca em rodadas: pode haver pendentes invalidos no meio da fila FIFO.
    while restantes > 0:
        stmt = (
            select(NfpCupomLidoDB)
            .where(
                NfpCupomLidoDB.organizacao_id == organizacao_id,
                NfpCupomLidoDB.status == STATUS_PENDENTE,
            )
            .order_by(NfpCupomLidoDB.lido_em.asc())
            .limit(min(max(restantes * 2, restantes + 30), TAMANHO_LOTE_PADRAO * 3))
        )
        conn = await db.connection()
        if getattr(conn.dialect, "name", "") == "postgresql":
            stmt = stmt.with_for_update(skip_locked=True)

        rows = (await db.execute(stmt)).scalars().all()
        if not rows:
            break

        validos_nesta_rodada = 0
        invalidos_nesta_rodada = 0
        for row in rows:
            if restantes <= 0:
                break
            ok_chave, motivo_chave = validar_chave_acesso_nfe(row.chave or "")
            if not ok_chave:
                row.status = STATUS_ERRO
                row.lote_id = None
                row.reservado_em = None
                row.reservado_por = None
                row.atualizado_em = agora
                row.mensagem = mensagem_chave_invalida(motivo_chave)
                invalidos_nesta_rodada += 1
                continue

            row.status = STATUS_RESERVADO
            row.lote_id = lote_id
            row.reservado_em = agora
            row.reservado_por = usuario_id or None
            row.atualizado_em = agora
            row.mensagem = f"Reservado para envio SEFAZ (lote {lote_id[:8]}…)."
            chaves.append(row.chave)
            restantes -= 1
            validos_nesta_rodada += 1

        # Garante que erro/reservado ja gravados nao voltem na proxima SELECT.
        await db.flush()
        if validos_nesta_rodada == 0 and invalidos_nesta_rodada == 0:
            break
        if validos_nesta_rodada == 0 and invalidos_nesta_rodada > 0:
            continue
        if restantes <= 0:
            break

    await db.commit()
    if not chaves:
        return {"lote_id": None, "chaves": [], "qtd": 0}
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
        ok_chave, motivo_chave = validar_chave_acesso_nfe(chave)
        if not ok_chave:
            status_cc = "erro"
            if not (item.get("mensagem") or "").strip():
                item = dict(item)
                item["mensagem"] = mensagem_chave_invalida(motivo_chave)
        elif status_cc not in {"enviado", "erro", "pendente", "rejeitado_prazo"}:
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
        # Nao reabrir fila com pendente se a chave e estruturalmente invalida.
        if not ok_chave:
            status_cc = "erro"
        row.status = status_cc
        row.mensagem = (item.get("mensagem") or row.mensagem or "")[:2000] or row.mensagem
        if not ok_chave and not (row.mensagem or "").strip():
            row.mensagem = mensagem_chave_invalida(motivo_chave)
        tipo_sefaz = (item.get("tipo") or item.get("tipo_retorno_sefaz") or "").strip().lower()
        if tipo_sefaz:
            row.tipo_retorno_sefaz = tipo_sefaz[:40]
        numero_sefaz = limpar_nota(str(item.get("numero_nota_sefaz") or ""))
        if numero_sefaz:
            row.numero_nota_sefaz = numero_sefaz
        cnpj_sefaz = "".join(ch for ch in str(item.get("cnpj_sefaz") or "") if ch.isdigit())
        if len(cnpj_sefaz) >= 11:
            row.cnpj_sefaz = cnpj_sefaz
        data_nota = (item.get("data_nota_sefaz") or "").strip()
        if data_nota:
            row.data_nota_sefaz = data_nota[:10]
        try:
            v_sefaz = item.get("valor_sefaz_centavos")
            if v_sefaz is not None and str(v_sefaz).strip() != "":
                row.valor_sefaz_centavos = int(v_sefaz)
        except (TypeError, ValueError):
            pass
        reg_em = item.get("sefaz_registrado_em")
        if reg_em:
            if isinstance(reg_em, datetime):
                row.sefaz_registrado_em = reg_em
            else:
                parsed = parse_sefaz_registrado_em(str(reg_em))
                if parsed:
                    row.sefaz_registrado_em = parsed
        elif item.get("mensagem"):
            parsed = parse_sefaz_registrado_em(str(item.get("mensagem") or ""))
            if parsed:
                row.sefaz_registrado_em = parsed
        row.atualizado_em = agora
        if status_cc == "enviado":
            row.enviado_em = agora
        row.lote_id = None
        row.reservado_em = None
        row.reservado_por = None
        atualizados += 1
    await db.commit()
    return atualizados
