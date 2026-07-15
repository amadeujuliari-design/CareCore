"""Cobertura da montagem otimizada do resumo /rotina/hoje."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, ConviventeDB, InstituicaoDB, RegistroRotinaDB, UsuarioDB
from routers.conviventes import (
    STATUS_CONVIVENTE_OPERACIONAIS_ROTINA,
    _ultimos_registros_rotina_por_grupo,
)


async def _rodar() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        session.add(InstituicaoDB(
            id="inst-1",
            nome_fantasia="SIAT Teste",
            telefone="11999999999",
        ))
        session.add(UsuarioDB(
            id="user-1",
            instituicao_id="inst-1",
            nome="Operador",
            email="op.rotina.otim@test.local",
            senha_hash="hash-teste",
            perfil_acesso="Gestor",
        ))
        session.add(ConviventeDB(
            id="conv-ativo",
            instituicao_id="inst-1",
            nome_completo="Ativo Teste",
            status="Ativo",
            numero_institucional=1,
        ))
        session.add(ConviventeDB(
            id="conv-inativo",
            instituicao_id="inst-1",
            nome_completo="Inativo Teste",
            status="Inativado",
            numero_institucional=2,
        ))

        agora = datetime(2026, 7, 14, 10, 0, 0)
        session.add_all(
            [
                RegistroRotinaDB(
                    id="r1",
                    instituicao_id="inst-1",
                    convivente_id="conv-ativo",
                    usuario_id="user-1",
                    tipo_registro="Entrada",
                    data_registro=agora - timedelta(days=2),
                    cancelado=False,
                ),
                RegistroRotinaDB(
                    id="r2",
                    instituicao_id="inst-1",
                    convivente_id="conv-ativo",
                    usuario_id="user-1",
                    tipo_registro="Saída",
                    data_registro=agora - timedelta(hours=1),
                    cancelado=False,
                ),
                RegistroRotinaDB(
                    id="r3",
                    instituicao_id="inst-1",
                    convivente_id="conv-ativo",
                    usuario_id="user-1",
                    tipo_registro="Retirada de Cobertor",
                    data_registro=agora - timedelta(days=1),
                    cancelado=False,
                ),
                RegistroRotinaDB(
                    id="r4",
                    instituicao_id="inst-1",
                    convivente_id="conv-ativo",
                    usuario_id="user-1",
                    tipo_registro="Entrega de Cobertor",
                    data_registro=agora,
                    cancelado=False,
                ),
                RegistroRotinaDB(
                    id="r5",
                    instituicao_id="inst-1",
                    convivente_id="conv-inativo",
                    usuario_id="user-1",
                    tipo_registro="Entrada",
                    data_registro=agora,
                    cancelado=False,
                ),
            ]
        )
        await session.commit()

        movimentos = await _ultimos_registros_rotina_por_grupo(
            session,
            instituicao_id="inst-1",
            tipos=["Entrada", "Saída"],
            convivente_ids=["conv-ativo"],
        )
        assert len(movimentos) == 1
        assert movimentos[0].tipo_registro == "Saída"
        assert movimentos[0].convivente_id == "conv-ativo"

        cobertor = await _ultimos_registros_rotina_por_grupo(
            session,
            instituicao_id="inst-1",
            tipos=["Retirada de Cobertor", "Entrega de Cobertor"],
            convivente_ids=["conv-ativo"],
            grupo_por_tipo={
                "Retirada de Cobertor": "Cobertor",
                "Entrega de Cobertor": "Cobertor",
            },
        )
        assert len(cobertor) == 1
        assert cobertor[0].tipo_registro == "Entrega de Cobertor"
        assert "Ativo" in STATUS_CONVIVENTE_OPERACIONAIS_ROTINA

    await engine.dispose()


def test_ultimos_registros_respeitam_grupo_e_escopo():
    asyncio.run(_rodar())
