"""
Baixa um snapshot somente-leitura do Postgres online e grava em SQLite local.

Uso:
  1. Copie env.snapshot.example para .env.snapshot e preencha SNAPSHOT_DATABASE_URL.
  2. python scripts/baixar_snapshot_online.py
  3. python scripts/baixar_snapshot_online.py --ativar   # substitui carecore_aeb.db

O script nunca escreve no banco online (apenas SELECT).
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import subprocess
import sys
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path

import psycopg2
import psycopg2.extras
from psycopg2 import sql


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DESTINO = ROOT_DIR / "carecore_aeb_snapshot_online.db"
DEFAULT_ATIVO = ROOT_DIR / "carecore_aeb.db"
BATCH_SIZE = 5_000


def carregar_env_snapshot() -> None:
    env_path = ROOT_DIR / ".env.snapshot"
    if not env_path.exists():
        return
    for linha in env_path.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def normalizar_postgres_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://") :]
    elif url.startswith("postgresql+psycopg2://"):
        url = "postgresql://" + url[len("postgresql+psycopg2://") :]
    elif url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    url = url.replace("ssl=require", "sslmode=require")
    if url.startswith("postgresql://") and "sslmode=" not in url:
        separador = "&" if "?" in url else "?"
        url = f"{url}{separador}sslmode=require"
    return url


def resolver_snapshot_url() -> str:
    carregar_env_snapshot()
    url = os.environ.get("SNAPSHOT_DATABASE_URL") or os.environ.get("DATABASE_URL_SNAPSHOT")
    if not url:
        raise RuntimeError(
            "Configure SNAPSHOT_DATABASE_URL em .env.snapshot "
            f"(copie de {ROOT_DIR / 'env.snapshot.example'})."
        )
    if url.startswith("sqlite"):
        raise RuntimeError("SNAPSHOT_DATABASE_URL deve apontar para Postgres (producao), nao SQLite.")
    return normalizar_postgres_url(url)


def resolver_path(valor: str | Path) -> Path:
    path = Path(valor).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path.resolve()


def timestamp_sp() -> str:
    try:
        from zoneinfo import ZoneInfo

        agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        agora = datetime.now()
    return agora.strftime("%Y%m%d_%H%M%S")


def backup_arquivo(origem: Path, pasta: Path) -> Path | None:
    if not origem.exists():
        return None
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"{origem.stem}_backup_{timestamp_sp()}{origem.suffix}"
    shutil.copy2(origem, destino)
    return destino


def rodar_alembic(destino_sqlite: Path) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{destino_sqlite.as_posix()}"
    subprocess.run(["alembic", "upgrade", "head"], cwd=ROOT_DIR, env=env, check=True)


def adaptar_valor(valor):
    if valor is None:
        return None
    if isinstance(valor, memoryview):
        return bytes(valor)
    if isinstance(valor, uuid.UUID):
        return str(valor)
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat(sep=" ", timespec="seconds") if isinstance(valor, datetime) else valor.isoformat()
    if isinstance(valor, dict | list):
        import json

        return json.dumps(valor, ensure_ascii=False)
    return valor


def listar_tabelas_postgres(cur) -> list[str]:
    cur.execute(
        """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
        """
    )
    return [row[0] for row in cur.fetchall()]


def listar_colunas_postgres(cur, tabela: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (tabela,),
    )
    return [row[0] for row in cur.fetchall()]


def tabela_existe_sqlite(cur_sqlite: sqlite3.Cursor, tabela: str) -> bool:
    cur_sqlite.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (tabela,),
    )
    return cur_sqlite.fetchone() is not None


def copiar_tabela(pg_cur, sqlite_con, tabela: str, colunas: list[str]) -> int:
    sqlite_cur = sqlite_con.cursor()
    cols_sql = ", ".join(f'"{c}"' for c in colunas)
    placeholders = ", ".join("?" for _ in colunas)
    insert_sql = f'INSERT INTO "{tabela}" ({cols_sql}) VALUES ({placeholders})'

    query = sql.SQL("SELECT {} FROM {}").format(
        sql.SQL(", ").join(sql.Identifier(c) for c in colunas),
        sql.Identifier(tabela),
    )
    pg_cur.execute(query)

    total = 0
    while True:
        lote = pg_cur.fetchmany(BATCH_SIZE)
        if not lote:
            break
        sqlite_cur.executemany(
            insert_sql,
            [tuple(adaptar_valor(v) for v in linha) for linha in lote],
        )
        total += len(lote)
        if total and total % 50_000 == 0:
            print(f"    ... {total:,} linhas")
    return total


def validar_sqlite(destino: Path) -> dict[str, int | str]:
    con = sqlite3.connect(destino)
    try:
        cur = con.cursor()
        integridade = cur.execute("PRAGMA integrity_check").fetchone()[0]
        if integridade != "ok":
            raise RuntimeError(f"integrity_check falhou: {integridade}")
        alembic = cur.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        metricas: dict[str, int | str] = {"alembic_version": alembic}
        for tabela in ("conviventes", "historico_legado_rotina_siat", "usuarios"):
            if tabela_existe_sqlite(cur, tabela):
                metricas[tabela] = cur.execute(f'SELECT COUNT(*) FROM "{tabela}"').fetchone()[0]
        return metricas
    finally:
        con.close()


def executar_snapshot(destino: Path, ativar: bool) -> None:
    origem_url = resolver_snapshot_url()
    destino.parent.mkdir(parents=True, exist_ok=True)

    if destino.exists():
        backup = backup_arquivo(destino, ROOT_DIR / "backups")
        if backup:
            print(f"Backup do destino anterior: {backup}")
        destino.unlink()

    print(f"Criando schema SQLite em {destino.name} (alembic upgrade head)...")
    rodar_alembic(destino)

    print("Conectando ao Postgres online (somente leitura)...")
    pg_con = psycopg2.connect(origem_url)
    pg_con.set_session(readonly=True, autocommit=True)
    sqlite_con = sqlite3.connect(destino)

    try:
        pg_cur = pg_con.cursor()
        sqlite_cur = sqlite_con.cursor()
        sqlite_cur.execute("PRAGMA foreign_keys = OFF")
        sqlite_cur.execute("PRAGMA journal_mode = WAL")
        sqlite_cur.execute("PRAGMA synchronous = NORMAL")

        tabelas = listar_tabelas_postgres(pg_cur)
        copiadas: list[tuple[str, int]] = []
        ignoradas: list[str] = []

        for tabela in tabelas:
            if tabela == "alembic_version":
                continue
            if not tabela_existe_sqlite(sqlite_cur, tabela):
                ignoradas.append(tabela)
                continue

            colunas = listar_colunas_postgres(pg_cur, tabela)
            colunas_sqlite = {
                row[1]
                for row in sqlite_cur.execute(f'PRAGMA table_info("{tabela}")').fetchall()
            }
            colunas = [c for c in colunas if c in colunas_sqlite]
            if not colunas:
                ignoradas.append(tabela)
                continue

            sqlite_cur.execute(f'DELETE FROM "{tabela}"')
            print(f"  {tabela}...")
            total = copiar_tabela(pg_cur, sqlite_con, tabela, colunas)
            copiadas.append((tabela, total))
            sqlite_con.commit()

        pg_cur.execute("SELECT version_num FROM alembic_version")
        versao_online = pg_cur.fetchone()[0]
        sqlite_cur.execute("DELETE FROM alembic_version")
        sqlite_cur.execute("INSERT INTO alembic_version (version_num) VALUES (?)", (versao_online,))
        sqlite_con.commit()
        sqlite_cur.execute("PRAGMA foreign_keys = ON")
        sqlite_con.commit()
    finally:
        pg_con.close()
        sqlite_con.close()

    metricas = validar_sqlite(destino)
    print("\nSnapshot concluido.")
    print(f"  Arquivo: {destino}")
    print(f"  Tabelas copiadas: {len(copiadas)}")
    if ignoradas:
        print(f"  Tabelas ignoradas (sem par no SQLite): {len(ignoradas)}")
    print(f"  Alembic online/local: {metricas.get('alembic_version')}")
    for chave in ("conviventes", "historico_legado_rotina_siat", "usuarios"):
        if chave in metricas:
            print(f"  {chave}: {metricas[chave]:,}")

    maiores = sorted(copiadas, key=lambda item: item[1], reverse=True)[:5]
    if maiores:
        print("  Maiores tabelas:")
        for nome, total in maiores:
            print(f"    - {nome}: {total:,}")

    if ativar:
        backup_ativo = backup_arquivo(DEFAULT_ATIVO, ROOT_DIR / "backups")
        if backup_ativo:
            print(f"\nBackup do banco ativo local: {backup_ativo}")
        shutil.copy2(destino, DEFAULT_ATIVO)
        print(f"Banco ativo local atualizado: {DEFAULT_ATIVO}")
        print("Reinicie o backend local (iniciar.bat) para usar o snapshot.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Baixa snapshot do Postgres online para SQLite local (somente leitura na origem)."
    )
    parser.add_argument(
        "--destino",
        default=str(DEFAULT_DESTINO),
        help=f"Arquivo SQLite de saida (padrao: {DEFAULT_DESTINO.name})",
    )
    parser.add_argument(
        "--ativar",
        action="store_true",
        help="Apos gerar o snapshot, copia para carecore_aeb.db (com backup do arquivo atual).",
    )
    args = parser.parse_args()

    destino = resolver_path(args.destino)
    print("=" * 60)
    print("CareCore+ — snapshot online -> SQLite local")
    print("=" * 60)
    print("Origem: Postgres producao (SELECT apenas)")
    print(f"Destino: {destino}")
    if args.ativar:
        print(f"Ativar: sim -> {DEFAULT_ATIVO.name}")
    print()

    try:
        executar_snapshot(destino, ativar=args.ativar)
    except Exception as exc:
        print(f"\nERRO: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
