"""Testes de API do relatório cadastros novos (endpoint + banco em memória)."""
from __future__ import annotations

import asyncio
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, ConviventeDB, InstituicaoDB, UsuarioDB
from routers.conviventes import (
    STATUS_CADASTROS_NOVOS_PADRAO,
    _parse_status_filtro_cadastros_novos,
    relatorio_cadastros_novos,
)

INSTITUICAO_ID = "inst-cadastros-api"
USUARIO_ID = "user-cadastros-api"
CONV_INCLUSAO_ID = "conv-inclusao-api"
CONV_INATIVO_ID = "conv-inativo-cad-api"
CONV_VINCULACAO_ID = "conv-vinc-api"


def _usuario_fixture() -> dict:
    return {
        "sub": USUARIO_ID,
        "instituicao_id": INSTITUICAO_ID,
        "perfil_acesso": "Gestor",
        "is_global": False,
    }


async def _criar_banco_seed(session: AsyncSession) -> None:
    session.add(InstituicaoDB(
        id=INSTITUICAO_ID,
        nome_fantasia="Projeto Teste Cadastros",
        telefone="11988887777",
    ))
    session.add(UsuarioDB(
        id=USUARIO_ID,
        instituicao_id=INSTITUICAO_ID,
        nome="Técnico Cadastros API",
        email="tecnico.cadastros.api@test.local",
        senha_hash="hash-teste",
        perfil_acesso="Gestor",
    ))
    session.add(ConviventeDB(
        id=CONV_INCLUSAO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Inclusão Junho API",
        numero_institucional=201,
        status="Ativo",
        data_inclusao=date(2026, 6, 10),
        data_entrada=date(2026, 6, 10),
    ))
    session.add(ConviventeDB(
        id=CONV_INATIVO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Inativado Junho API",
        numero_institucional=202,
        status="Inativado",
        data_inclusao=date(2026, 6, 12),
        data_inativacao=date(2026, 6, 20),
        data_entrada=date(2026, 6, 1),
    ))
    session.add(ConviventeDB(
        id=CONV_VINCULACAO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Nova Vinculação API",
        numero_institucional=203,
        status="Ativo",
        data_inclusao=date(2025, 1, 5),
        data_nova_vinculacao=date(2026, 6, 8),
        data_entrada=date(2025, 1, 5),
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


async def _executar_relatorio(
    session: AsyncSession,
    *,
    criterio: str = "inclusoes",
    status: str | None = None,
):
    return await relatorio_cadastros_novos(
        data_inicio="2026-06-01",
        data_fim="2026-06-30",
        criterio=criterio,
        status=status,
        tecnico_id=None,
        busca=None,
        db=session,
        usuario_atual=_usuario_fixture(),
    )


def test_parse_status_filtro_cadastros_novos_api():
    assert _parse_status_filtro_cadastros_novos(None) == list(STATUS_CADASTROS_NOVOS_PADRAO)
    assert _parse_status_filtro_cadastros_novos("Ativo,Inativado") == ["Ativo", "Inativado"]


def test_api_cadastros_novos_inclusoes_padrao_exclui_inativado():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session)
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONV_INCLUSAO_ID in ids
        assert CONV_INATIVO_ID not in ids
        assert CONV_VINCULACAO_ID not in ids
        assert dados["criterio"] == "inclusoes"
        assert dados["status_filtro"] == list(STATUS_CADASTROS_NOVOS_PADRAO)

    asyncio.run(_rodar_com_banco(caso))


def test_api_cadastros_novos_nova_vinculacao():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session, criterio="nova_vinculacao")
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONV_VINCULACAO_ID in ids
        assert CONV_INCLUSAO_ID not in ids

        linha = next(item for item in dados["linhas"] if item["convivente_id"] == CONV_VINCULACAO_ID)
        assert linha["data_nova_vinculacao"] == "2026-06-08"

    asyncio.run(_rodar_com_banco(caso))


def test_api_cadastros_novos_status_inativado_quando_solicitado():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session, status="Inativado")
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONV_INATIVO_ID in ids
        assert CONV_INCLUSAO_ID not in ids
        assert dados["status_filtro"] == ["Inativado"]

    asyncio.run(_rodar_com_banco(caso))
