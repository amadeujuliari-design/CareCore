"""Leitura rapida de cupons: grava checando e rejeita CPF do QR na hora."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, NfpCupomLidoDB, OrganizacaoDB
from nfp_cupom_leitura_service import (
    STATUS_CHECANDO,
    STATUS_PENDENTE,
    STATUS_REJEITADO_CPF,
    STATUS_REJEITADO_PRAZO,
    _aplicar_checagem_sefaz,
    registrar_leitura_rapida,
)
from nfp_cupom_utils import ResultadoChaveCupom

CHAVE_OK = "35260847508411169495651090002701871160307536"
CHAVE_CPF = "35260847508411169495651090002701871160307537"
ORG = "org-nfp-leitura-test"


async def _preparar():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        session.add(OrganizacaoDB(id=ORG, nome="Org Teste NFP"))
        await session.commit()
    return engine, factory


def test_leitura_rapida_agenda_checando_sem_bloquear_sefaz():
    async def caso():
        engine, factory = await _preparar()
        try:
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz") as mock_agendar:
                    out = await registrar_leitura_rapida(
                        session,
                        organizacao_id=ORG,
                        captador="SEDE AEB",
                        bruto=CHAVE_OK,
                        usuario_id="u1",
                    )
                assert out["checagem"] == "agendada"
                assert out["cupom"].status == STATUS_CHECANDO
                assert out["cupom"].consumidor_identificado is None
                mock_agendar.assert_called_once_with(out["cupom"].id)
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_leitura_rapida_rejeita_cpf_no_qr_imediatamente():
    async def caso():
        engine, factory = await _preparar()
        try:
            bruto = (
                "https://www.nfce.fazenda.sp.gov.br/nfce/qrcode?"
                f"p={CHAVE_CPF}|3|1|01|10.00|2|04817513357|ABC"
            )
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz") as mock_agendar:
                    out = await registrar_leitura_rapida(
                        session,
                        organizacao_id=ORG,
                        captador="SEDE AEB",
                        bruto=bruto,
                    )
                assert out["checagem"] == "imediata_cpf"
                assert out["cupom"].status == STATUS_REJEITADO_CPF
                assert out["cupom"].consumidor_identificado is True
                mock_agendar.assert_not_called()
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_leitura_rapida_duplicata_levanta_lookup():
    async def caso():
        engine, factory = await _preparar()
        try:
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz"):
                    await registrar_leitura_rapida(
                        session,
                        organizacao_id=ORG,
                        captador="SEDE AEB",
                        bruto=CHAVE_OK,
                    )
                    raised = False
                    try:
                        await registrar_leitura_rapida(
                            session,
                            organizacao_id=ORG,
                            captador="SEDE AEB",
                            bruto=CHAVE_OK,
                        )
                    except LookupError:
                        raised = True
                    assert raised
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_worker_checagem_vira_pendente_quando_sem_cpf():
    async def caso():
        engine, factory = await _preparar()
        try:
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz"):
                    out = await registrar_leitura_rapida(
                        session,
                        organizacao_id=ORG,
                        captador="SEDE AEB",
                        bruto=CHAVE_OK,
                    )
                cupom_id = out["cupom"].id

            resultado = ResultadoChaveCupom(
                chave=CHAVE_OK,
                qr_bruto=CHAVE_OK,
                consumidor_identificado=False,
                mensagem="Consumidor nao identificado",
            )
            with patch(
                "nfp_cupom_leitura_service.consultar_elegibilidade_cupom",
                return_value=resultado,
            ), patch(
                "nfp_cupom_leitura_service.AsyncSessionLocal",
                factory,
            ):
                await _aplicar_checagem_sefaz(cupom_id)

            async with factory() as s2:
                row = await s2.get(NfpCupomLidoDB, cupom_id)
                assert row is not None
                assert row.status == STATUS_PENDENTE
                assert row.consumidor_identificado is False
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_worker_checagem_rejeita_quando_sefaz_indica_cpf():
    async def caso():
        engine, factory = await _preparar()
        try:
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz"):
                    out = await registrar_leitura_rapida(
                        session,
                        organizacao_id=ORG,
                        captador="SEDE AEB",
                        bruto=CHAVE_OK,
                    )
                cupom_id = out["cupom"].id

            resultado = ResultadoChaveCupom(
                chave=CHAVE_OK,
                qr_bruto=CHAVE_OK,
                consumidor_identificado=True,
                mensagem="CPF no HTML",
            )
            with patch(
                "nfp_cupom_leitura_service.consultar_elegibilidade_cupom",
                return_value=resultado,
            ), patch(
                "nfp_cupom_leitura_service.AsyncSessionLocal",
                factory,
            ):
                await _aplicar_checagem_sefaz(cupom_id)

            async with factory() as s2:
                row = await s2.get(NfpCupomLidoDB, cupom_id)
                assert row.status == STATUS_REJEITADO_CPF
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_leitura_rapida_rejeita_prazo_imediatamente():
    async def caso():
        engine, factory = await _preparar()
        try:
            # AAMM 2401 → emissao 2024-01; limite leitura 2024-02-21
            chave_antiga = "35240147508411169495651090002701871160307536"
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz") as mock_agendar:
                    with patch(
                        "nfp_cupom_leitura_service.agora_operacional_naive"
                    ) as mock_agora:
                        from datetime import datetime

                        mock_agora.return_value = datetime(2026, 8, 12, 12, 0, 0)
                        out = await registrar_leitura_rapida(
                            session,
                            organizacao_id=ORG,
                            captador="SEDE AEB",
                            bruto=chave_antiga,
                        )
                assert out["checagem"] == "imediata_prazo"
                assert out["cupom"].status == STATUS_REJEITADO_PRAZO
                assert "prazo" in (out["cupom"].mensagem or "").lower()
                mock_agendar.assert_not_called()
        finally:
            await engine.dispose()

    asyncio.run(caso())


def test_leitura_ainda_aceita_no_dia_da_folga():
    async def caso():
        engine, factory = await _preparar()
        try:
            # Emissao 2026-07 → SEFAZ 2026-08-20; leitura ate 2026-08-21
            chave = "35260747508411169495651090002701871160307536"
            async with factory() as session:
                with patch("nfp_cupom_leitura_service.agendar_checagem_sefaz") as mock_agendar:
                    with patch(
                        "nfp_cupom_leitura_service.agora_operacional_naive"
                    ) as mock_agora:
                        from datetime import datetime

                        mock_agora.return_value = datetime(2026, 8, 21, 23, 0, 0)
                        out = await registrar_leitura_rapida(
                            session,
                            organizacao_id=ORG,
                            captador="SEDE AEB",
                            bruto=chave,
                        )
                assert out["checagem"] == "agendada"
                assert out["cupom"].status == STATUS_CHECANDO
                mock_agendar.assert_called_once()
        finally:
            await engine.dispose()

    asyncio.run(caso())
