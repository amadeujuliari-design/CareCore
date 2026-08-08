"""Reserva de lotes de cupons NFP (fatias de 100)."""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, NfpCupomLidoDB, OrganizacaoDB
from nfp_cupom_reserva_service import (
    STATUS_PENDENTE,
    STATUS_RESERVADO,
    liberar_lote,
    reservar_lote_cupons,
)
from time_operacional import agora_operacional_naive

ORG = "org-reserva-test"


async def _prep():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        session.add(OrganizacaoDB(id=ORG, nome="Org Reserva"))
        agora = agora_operacional_naive()
        for i in range(250):
            session.add(
                NfpCupomLidoDB(
                    organizacao_id=ORG,
                    chave=f"3526084750841116949565109000270187116030{i:04d}"[:44].ljust(44, "0"),
                    captador="SEDE AEB",
                    status=STATUS_PENDENTE,
                    lido_em=agora,
                    criado_em=agora,
                    atualizado_em=agora,
                )
            )
        await session.commit()
    return engine, factory


def test_reserva_lote_max_100():
    async def caso():
        engine, factory = await _prep()
        try:
            async with factory() as db:
                out = await reservar_lote_cupons(
                    db, organizacao_id=ORG, usuario_id="u1", tamanho=500
                )
            assert out["qtd"] == 100
            assert out["lote_id"]
            async with factory() as db:
                out2 = await reservar_lote_cupons(
                    db, organizacao_id=ORG, usuario_id="u2", tamanho=100
                )
            assert out2["qtd"] == 100
            assert out2["lote_id"] != out["lote_id"]
            async with factory() as db:
                res = (
                    await db.execute(
                        __import__("sqlalchemy").select(NfpCupomLidoDB.status)
                        .where(NfpCupomLidoDB.organizacao_id == ORG)
                    )
                ).scalars().all()
            assert res.count(STATUS_RESERVADO) == 200
            assert res.count(STATUS_PENDENTE) == 50
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_liberar_lote_devolve_pendente():
    async def caso():
        engine, factory = await _prep()
        try:
            async with factory() as db:
                out = await reservar_lote_cupons(
                    db, organizacao_id=ORG, usuario_id="u1", tamanho=100
                )
            async with factory() as db:
                n = await liberar_lote(db, organizacao_id=ORG, lote_id=out["lote_id"])
            assert n == 100
            async with factory() as db:
                pend = (
                    await db.execute(
                        __import__("sqlalchemy").select(NfpCupomLidoDB)
                        .where(
                            NfpCupomLidoDB.organizacao_id == ORG,
                            NfpCupomLidoDB.status == STATUS_PENDENTE,
                        )
                    )
                ).scalars().all()
            assert len(pend) == 250
        finally:
            await engine.dispose()

    asyncio.run(caso())
