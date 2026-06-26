"""Testes de API da manutenção de registros de rotina (cancelar / permissão)."""
from __future__ import annotations

import asyncio
from datetime import date, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, ConviventeDB, InstituicaoDB, RegistroRotinaDB, UsuarioDB
from routers.conviventes import (
    cancelar_registro_rotina,
    relatorio_presenca_periodo,
    verificar_permissao_edicao,
)
from schemas import RegistroRotinaCancelamento

INSTITUICAO_ID = "inst-rotina-api"
GESTOR_ID = "user-gestor-rotina-api"
TECNICO_RESP_ID = "user-tecnico-resp-api"
TECNICO_OUTRO_ID = "user-tecnico-outro-api"
CONVIVENTE_ID = "conv-rotina-api"
REGISTRO_ENTRADA_ID = "reg-entrada-rotina-api"


def _usuario(perfil: str, usuario_id: str) -> dict:
    return {
        "sub": usuario_id,
        "instituicao_id": INSTITUICAO_ID,
        "perfil_acesso": perfil,
        "is_global": False,
    }


async def _criar_banco_seed(session: AsyncSession) -> None:
    session.add(InstituicaoDB(
        id=INSTITUICAO_ID,
        nome_fantasia="Projeto Teste Rotina",
        telefone="11977776666",
    ))
    for usuario_id, nome, email in (
        (GESTOR_ID, "Gestor Rotina API", "gestor.rotina.api@test.local"),
        (TECNICO_RESP_ID, "Técnico Responsável API", "tecnico.resp.rotina.api@test.local"),
        (TECNICO_OUTRO_ID, "Técnico Outro API", "tecnico.outro.rotina.api@test.local"),
    ):
        session.add(UsuarioDB(
            id=usuario_id,
            instituicao_id=INSTITUICAO_ID,
            nome=nome,
            email=email,
            senha_hash="hash-teste",
            perfil_acesso="Técnico" if usuario_id != GESTOR_ID else "Gestor",
        ))
    session.add(ConviventeDB(
        id=CONVIVENTE_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=TECNICO_RESP_ID,
        nome_completo="Convivente Rotina API",
        numero_institucional=301,
        status="Ativo",
        data_entrada=date(2026, 6, 1),
    ))
    session.add(RegistroRotinaDB(
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_ID,
        usuario_id=TECNICO_RESP_ID,
        tipo_registro="Entrada",
        data_registro=datetime(2026, 6, 8, 8, 0),
        cancelado=False,
    ))
    session.add(RegistroRotinaDB(
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_ID,
        usuario_id=TECNICO_RESP_ID,
        tipo_registro="Saída",
        data_registro=datetime(2026, 6, 8, 18, 0),
        cancelado=False,
    ))
    session.add(RegistroRotinaDB(
        id=REGISTRO_ENTRADA_ID,
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_ID,
        usuario_id=TECNICO_RESP_ID,
        tipo_registro="Entrada",
        data_registro=datetime(2026, 6, 9, 9, 0),
        cancelado=False,
    ))
    await session.commit()


async def _rodar_com_banco(coro_factory):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        await _criar_banco_seed(session)
        return await coro_factory(session)

    await engine.dispose()


def test_api_rotina_gestor_cancela_entrada():
    async def caso(session: AsyncSession):
        registro = await cancelar_registro_rotina(
            REGISTRO_ENTRADA_ID,
            RegistroRotinaCancelamento(motivo_cancelamento="Correção operacional em teste"),
            db=session,
            usuario_atual=_usuario("Gestor", GESTOR_ID),
        )
        assert registro.cancelado is True
        assert registro.motivo_cancelamento == "Correção operacional em teste"

    asyncio.run(_rodar_com_banco(caso))


def test_api_rotina_tecnico_nao_responsavel_nao_cancela():
    async def caso(session: AsyncSession):
        registro = (
            await session.execute(
                select(RegistroRotinaDB).where(RegistroRotinaDB.id == REGISTRO_ENTRADA_ID)
            )
        ).scalar_one()

        with pytest.raises(HTTPException) as exc:
            await verificar_permissao_edicao(
                session,
                _usuario("Técnico", TECNICO_OUTRO_ID),
                registro,
            )
        assert exc.value.status_code == 403

    asyncio.run(_rodar_com_banco(caso))


def test_api_rotina_cancelar_entrada_altera_matriz_presenca():
    """Com saída no dia anterior, cancelar a entrada do dia seguinte volta o dia para ausente."""

    async def caso(session: AsyncSession):
        antes = await relatorio_presenca_periodo(
            data_inicio="2026-06-09",
            data_fim="2026-06-09",
            tecnico_id=None,
            busca=None,
            status=None,
            status_convivente=None,
            filtro_situacao="presenca_ou_justificada",
            db=session,
            usuario_atual=_usuario("Gestor", GESTOR_ID),
        )
        linha_antes = next(item for item in antes["linhas"] if item["convivente_id"] == CONVIVENTE_ID)
        assert linha_antes["dias"]["2026-06-09"] == "presente"

        await cancelar_registro_rotina(
            REGISTRO_ENTRADA_ID,
            RegistroRotinaCancelamento(motivo_cancelamento="Entrada registrada por engano"),
            db=session,
            usuario_atual=_usuario("Gestor", GESTOR_ID),
        )

        depois = await relatorio_presenca_periodo(
            data_inicio="2026-06-09",
            data_fim="2026-06-09",
            tecnico_id=None,
            busca=None,
            status=None,
            status_convivente=None,
            filtro_situacao="apenas_ausencia",
            db=session,
            usuario_atual=_usuario("Gestor", GESTOR_ID),
        )
        linha_depois = next(item for item in depois["linhas"] if item["convivente_id"] == CONVIVENTE_ID)
        assert linha_depois["dias"]["2026-06-09"] == "ausente"

    asyncio.run(_rodar_com_banco(caso))
