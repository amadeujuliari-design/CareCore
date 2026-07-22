"""
Captura / backfill dos retratos do Dashboard Operacional (22:00 America/Sao_Paulo).

Uso:
  # Captura do dia (só grava se já passou das 22:00 e ainda não existe)
  python scripts/capturar_dashboard_operacional_snapshots.py

  # Força captura do instante atual (manutenção)
  python scripts/capturar_dashboard_operacional_snapshots.py --forcar

  # Reconstrói dias passados (não sobrescreve existentes)
  python scripts/capturar_dashboard_operacional_snapshots.py --backfill --inicio 2026-06-26 --fim 2026-07-21

  # Online: definir DATABASE_URL do Postgres de produção antes de rodar.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from time_operacional import agora_operacional_naive


def norm_url(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _database_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return norm_url(url)
    local = ROOT / "carecore_aeb.db"
    return f"sqlite+aiosqlite:///{local.as_posix()}"


async def main_async(args: argparse.Namespace) -> int:
    from dashboard_operacional_snapshot import (
        backfill_snapshots_periodo,
        capturar_snapshots_pendentes_todas_instituicoes,
    )

    url = _database_url()
    engine = create_async_engine(url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        if args.backfill:
            inicio = date.fromisoformat(args.inicio) if args.inicio else date(2026, 6, 26)
            if args.fim:
                fim = date.fromisoformat(args.fim)
            else:
                fim = agora_operacional_naive().date() - timedelta(days=1)
            resultado = await backfill_snapshots_periodo(
                db,
                data_inicio=inicio,
                data_fim=fim,
                instituicao_id=args.instituicao_id,
            )
            print(resultado)
        else:
            resultado = await capturar_snapshots_pendentes_todas_instituicoes(
                db,
                forcar=args.forcar,
            )
            print(resultado)

    await engine.dispose()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Retratos diários do dashboard operacional (22h SP)")
    p.add_argument("--forcar", action="store_true", help="Ignora o horário 22:00 (captura do dia atual)")
    p.add_argument("--backfill", action="store_true", help="Reconstrói período passado")
    p.add_argument("--inicio", type=str, default=None, help="AAAA-MM-DD (backfill)")
    p.add_argument("--fim", type=str, default=None, help="AAAA-MM-DD (backfill); padrão=ontem")
    p.add_argument("--instituicao-id", type=str, default=None, help="Opcional: só um projeto")
    return p


if __name__ == "__main__":
    parser = build_parser()
    ns = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(ns)))
