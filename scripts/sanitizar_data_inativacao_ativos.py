"""
Arquiva e limpa data_inativacao em conviventes com status operacional.

Uso (local ou com DATABASE_URL de produção):
  python scripts/sanitizar_data_inativacao_ativos.py
  python scripts/sanitizar_data_inativacao_ativos.py --aplicar
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from convivente_datas_cadastro import (
    STATUS_OPERACIONAIS,
    registrar_historico_inativacao,
)
from models import ConviventeDB, UsuarioDB
from time_operacional import agora_operacional_naive


def _database_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return url
    local = ROOT / "carecore_aeb.db"
    return f"sqlite+aiosqlite:///{local.as_posix()}"


async def _usuario_sistema(db: AsyncSession, instituicao_id: str) -> str | None:
    row = (
        await db.execute(
            select(UsuarioDB.id)
            .where(
                UsuarioDB.instituicao_id == instituicao_id,
                UsuarioDB.ativo.is_(True),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


async def executar(*, aplicar: bool) -> dict:
    engine = create_async_engine(_database_url(), echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        conviventes = (
            await db.execute(
                select(ConviventeDB).where(
                    ConviventeDB.status.in_(tuple(STATUS_OPERACIONAIS)),
                    ConviventeDB.data_inativacao.is_not(None),
                ).order_by(ConviventeDB.numero_institucional.asc())
            )
        ).scalars().all()

        registros = []
        corrigidos = 0
        for convivente in conviventes:
            registros.append(
                {
                    "id": convivente.id,
                    "prontuario": convivente.numero_institucional,
                    "nome": convivente.nome_completo,
                    "status": convivente.status,
                    "data_inativacao": (
                        convivente.data_inativacao.isoformat()
                        if convivente.data_inativacao
                        else None
                    ),
                }
            )
            if not aplicar:
                continue

            usuario_id = await _usuario_sistema(db, convivente.instituicao_id)
            if not usuario_id:
                continue

            await registrar_historico_inativacao(
                db,
                instituicao_id=convivente.instituicao_id,
                convivente_id=convivente.id,
                usuario_id=usuario_id,
                data_inativacao=convivente.data_inativacao,
                descricao=(
                    "Data de inativação arquivada por sanitização de cadastro operacional "
                    f"(status {convivente.status} com data_inativacao residual)."
                ),
            )
            convivente.data_inativacao = None
            corrigidos += 1

        if aplicar and corrigidos:
            await db.commit()

    await engine.dispose()
    return {
        "aplicar": aplicar,
        "encontrados": len(registros),
        "corrigidos": corrigidos if aplicar else 0,
        "registros": registros,
        "executado_em": agora_operacional_naive().isoformat(timespec="seconds"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Arquiva e limpa data_inativacao em status operacional.",
    )
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Persiste alterações (sem esta flag, apenas lista).",
    )
    args = parser.parse_args()
    resultado = asyncio.run(executar(aplicar=args.aplicar))
    print(
        f"encontrados={resultado['encontrados']} "
        f"corrigidos={resultado['corrigidos']} "
        f"aplicar={resultado['aplicar']}"
    )
    for item in resultado["registros"]:
        print(
            f"  #{item['prontuario']} {item['nome']} "
            f"[{item['status']}] data_inativacao={item['data_inativacao']}"
        )


if __name__ == "__main__":
    main()
