"""Relatorio operacional de cupons NFP."""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, NfpCupomLidoDB, OrganizacaoDB
from nfp_cupom_relatorio_service import relatorio_cupons
from time_operacional import agora_operacional_naive

ORG = "org-relatorio-cupons-test"


async def _prep():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        session.add(OrganizacaoDB(id=ORG, nome="Org Relatorio Cupons"))
        agora = agora_operacional_naive()
        session.add_all(
            [
                NfpCupomLidoDB(
                    organizacao_id=ORG,
                    chave=("1" * 44),
                    captador="SEDE AEB",
                    status="pendente",
                    lido_em=agora,
                    criado_em=agora,
                    atualizado_em=agora,
                ),
                NfpCupomLidoDB(
                    organizacao_id=ORG,
                    chave=("2" * 44),
                    captador="SEDE AEB",
                    status="enviado",
                    lido_em=agora,
                    enviado_em=agora,
                    criado_em=agora,
                    atualizado_em=agora,
                ),
                NfpCupomLidoDB(
                    organizacao_id=ORG,
                    chave=("3" * 44),
                    captador="CEI LIBERDADE",
                    status="erro",
                    lido_em=agora,
                    criado_em=agora,
                    atualizado_em=agora,
                ),
            ]
        )
        await session.commit()
    return engine, factory, agora


def test_relatorio_cupons_totais_e_filtros():
    async def caso():
        engine, factory, agora = await _prep()
        try:
            async with factory() as db:
                out = await relatorio_cupons(
                    db,
                    ORG,
                    data_inicio=agora.date().isoformat(),
                    data_fim=agora.date().isoformat(),
                )
                assert out["totais"]["lidos"] == 3
                assert out["totais"]["pendentes"] == 1
                assert out["totais"]["enviados"] == 1
                assert out["totais"]["erros"] == 1
                assert len(out["por_captador"]) == 2

                so_sede = await relatorio_cupons(
                    db,
                    ORG,
                    captador="SEDE AEB",
                    status="pendente,enviado",
                )
                assert so_sede["totais"]["lidos"] == 2
                assert so_sede["totais"]["erros"] == 0
        finally:
            await engine.dispose()

    asyncio.run(caso())
