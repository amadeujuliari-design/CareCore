"""Testes de API do relatório presença/ausência (endpoint + banco em memória)."""
from __future__ import annotations

import asyncio
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, ConviventeDB, InstituicaoDB, RegistroRotinaDB, UsuarioDB
from routers.conviventes import _parse_status_filtro_presenca, relatorio_presenca_periodo

INSTITUICAO_ID = "inst-presenca-api"
USUARIO_ID = "user-presenca-api"
CONVIVENTE_ATIVO_ID = "conv-ativo-api"
CONVIVENTE_INATIVO_ID = "conv-inativo-api"
CONVIVENTE_JUSTIFICADO_ID = "conv-justificado-api"


def _usuario_fixture() -> dict:
    return {
        "id": USUARIO_ID,
        "instituicao_id": INSTITUICAO_ID,
        "perfil_acesso": "Gestor",
        "is_global": False,
    }


async def _criar_banco_seed(session: AsyncSession) -> None:
    session.add(InstituicaoDB(
        id=INSTITUICAO_ID,
        nome_fantasia="Projeto Teste Presença",
        telefone="11999999999",
    ))
    session.add(UsuarioDB(
        id=USUARIO_ID,
        instituicao_id=INSTITUICAO_ID,
        nome="Técnico Teste",
        email="tecnico.presenca.api@test.local",
        senha_hash="hash-teste",
        perfil_acesso="Gestor",
    ))
    session.add(ConviventeDB(
        id=CONVIVENTE_ATIVO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Convivente Ativo API",
        numero_institucional=101,
        status="Ativo",
        data_entrada=date(2026, 6, 1),
    ))
    session.add(ConviventeDB(
        id=CONVIVENTE_INATIVO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Convivente Inativado API",
        numero_institucional=102,
        status="Inativado",
        data_entrada=date(2026, 6, 1),
        data_inativacao=date(2026, 6, 11),
    ))
    session.add(ConviventeDB(
        id=CONVIVENTE_JUSTIFICADO_ID,
        instituicao_id=INSTITUICAO_ID,
        tecnico_id=USUARIO_ID,
        nome_completo="Convivente Justificado API",
        numero_institucional=103,
        status="Ausência justificada",
        data_entrada=date(2026, 6, 1),
        ausencia_justificada_desde=date(2026, 6, 5),
    ))
    session.add(RegistroRotinaDB(
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_ATIVO_ID,
        usuario_id=USUARIO_ID,
        tipo_registro="Entrada",
        data_registro=datetime(2026, 6, 8, 9, 0),
        cancelado=False,
    ))
    session.add(RegistroRotinaDB(
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_ATIVO_ID,
        usuario_id=USUARIO_ID,
        tipo_registro="Saída",
        data_registro=datetime(2026, 6, 8, 18, 0),
        cancelado=False,
    ))
    session.add(RegistroRotinaDB(
        instituicao_id=INSTITUICAO_ID,
        convivente_id=CONVIVENTE_INATIVO_ID,
        usuario_id=USUARIO_ID,
        tipo_registro="Entrada",
        data_registro=datetime(2026, 6, 10, 8, 0),
        cancelado=False,
    ))
    await session.commit()


async def _executar_relatorio(
    session: AsyncSession,
    *,
    filtro_situacao: str = "presenca_ou_justificada",
    status: str | None = None,
):
    return await relatorio_presenca_periodo(
        data_inicio="2026-06-01",
        data_fim="2026-06-15",
        tecnico_id=None,
        busca=None,
        status=status,
        status_convivente=None,
        filtro_situacao=filtro_situacao,
        db=session,
        usuario_atual=_usuario_fixture(),
    )


async def _rodar_com_banco(coro_factory):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        await _criar_banco_seed(session)
        return await coro_factory(session)

    await engine.dispose()


def test_parse_status_filtro_presenca():
    assert _parse_status_filtro_presenca(None) is None
    assert _parse_status_filtro_presenca("") is None
    assert _parse_status_filtro_presenca("todos") is None
    assert _parse_status_filtro_presenca("Ativo,Inativado") == ["Ativo", "Inativado"]


def test_api_presenca_inclui_inativado_com_presenca_no_periodo():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session)
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONVIVENTE_INATIVO_ID in ids
        assert dados["status_filtro"] == []

        linha = next(item for item in dados["linhas"] if item["convivente_id"] == CONVIVENTE_INATIVO_ID)
        assert linha["status"] == "Inativado"
        assert linha["dias"]["2026-06-10"] == "presente"
        assert linha["dias"]["2026-06-12"] == "na"

    asyncio.run(_rodar_com_banco(caso))


def test_api_presenca_filtro_apenas_ausencia():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session, filtro_situacao="apenas_ausencia")
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONVIVENTE_ATIVO_ID in ids
        assert CONVIVENTE_JUSTIFICADO_ID not in ids

        linha_ativo = next(
            item for item in dados["linhas"] if item["convivente_id"] == CONVIVENTE_ATIVO_ID
        )
        assert linha_ativo["dias"]["2026-06-08"] == "presente"
        assert linha_ativo["dias"]["2026-06-09"] == "ausente"
        assert linha_ativo["totais"]["ausentes"] >= 1

    asyncio.run(_rodar_com_banco(caso))


def test_api_presenca_justificado_conta_como_presente():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session)
        linha = next(
            (item for item in dados["linhas"] if item["convivente_id"] == CONVIVENTE_JUSTIFICADO_ID),
            None,
        )
        assert linha is not None
        assert linha["dias"]["2026-06-06"] == "justificado"
        assert linha["totais"]["justificados"] >= 1

    asyncio.run(_rodar_com_banco(caso))


def test_api_presenca_status_filtro_restringe_listagem():
    async def caso(session: AsyncSession):
        dados = await _executar_relatorio(session, status="Inativado")
        ids = {linha["convivente_id"] for linha in dados["linhas"]}
        assert CONVIVENTE_INATIVO_ID in ids
        assert CONVIVENTE_ATIVO_ID not in ids
        assert dados["status_filtro"] == ["Inativado"]

    asyncio.run(_rodar_com_banco(caso))
