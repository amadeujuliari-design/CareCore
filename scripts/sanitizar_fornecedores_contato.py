"""
Sanitiza e-mail/telefone/CEP de compras_fornecedores (importação legada).

Uso:
  python scripts/sanitizar_fornecedores_contato.py --alvo local
  python scripts/sanitizar_fornecedores_contato.py --alvo local --aplicar
  python scripts/sanitizar_fornecedores_contato.py --alvo online
  python scripts/sanitizar_fornecedores_contato.py --alvo online --aplicar

Online usa SNAPSHOT_DATABASE_URL / DATABASE_URL_SNAPSHOT de .env.snapshot
(mesmo Postgres de produção, escrita só com --aplicar).
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from compras_fornecedor_contato_utils import sanitizar_campos_contato_fornecedor

CAMPOS = (
    "email",
    "email_empresa",
    "telefone",
    "contato",
    "cep",
    "logradouro",
    "numero",
    "bairro",
    "cidade",
    "observacao",
)


def _carregar_env_snapshot() -> None:
    env_path = ROOT / ".env.snapshot"
    if not env_path.exists():
        return
    for linha in env_path.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def _normalizar_postgres_url(url: str) -> str:
    url = url.strip()
    for prefixo, alvo in (
        ("postgresql+asyncpg://", "postgresql://"),
        ("postgresql+psycopg2://", "postgresql://"),
        ("postgres://", "postgresql://"),
    ):
        if url.startswith(prefixo):
            url = alvo + url[len(prefixo) :]
    url = url.replace("ssl=require", "sslmode=require")
    if url.startswith("postgresql://") and "sslmode=" not in url:
        url = f"{url}{'&' if '?' in url else '?'}sslmode=require"
    return url


def _url_online() -> str:
    _carregar_env_snapshot()
    url = os.environ.get("SNAPSHOT_DATABASE_URL") or os.environ.get("DATABASE_URL_SNAPSHOT")
    if not url:
        raise RuntimeError("Configure SNAPSHOT_DATABASE_URL em .env.snapshot")
    if url.startswith("sqlite"):
        raise RuntimeError("URL online deve ser Postgres.")
    return _normalizar_postgres_url(url)


def _registro_de_row(row) -> dict:
    return {campo: row[campo] for campo in CAMPOS}


def _diferencas(antes: dict, depois: dict) -> dict:
    return {
        k: depois.get(k)
        for k in CAMPOS
        if (antes.get(k) or None) != (depois.get(k) or None)
    }


def _rodar_sqlite(db_path: Path, aplicar: bool) -> int:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f"SELECT id, nome, {', '.join(CAMPOS)} FROM compras_fornecedores"
    ).fetchall()
    alterados = 0
    for row in rows:
        antes = _registro_de_row(row)
        depois, mudancas = sanitizar_campos_contato_fornecedor(antes)
        diffs = _diferencas(antes, depois)
        if not diffs:
            continue
        alterados += 1
        print(f"- {row['nome'][:50]}")
        for m in mudancas:
            print(f"    {m}")
        for campo, valor in diffs.items():
            print(f"    {campo}: {antes.get(campo)!r} -> {valor!r}")
        if aplicar:
            sets = ", ".join(f"{c}=?" for c in diffs)
            conn.execute(
                f"UPDATE compras_fornecedores SET {sets} WHERE id=?",
                [*diffs.values(), row["id"]],
            )
    if aplicar:
        conn.commit()
    conn.close()
    return alterados


def _rodar_postgres(aplicar: bool) -> int:
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(_url_online())
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"SELECT id, nome, {', '.join(CAMPOS)} FROM compras_fornecedores")
    rows = cur.fetchall()
    alterados = 0
    for row in rows:
        antes = _registro_de_row(row)
        depois, mudancas = sanitizar_campos_contato_fornecedor(antes)
        diffs = _diferencas(antes, depois)
        if not diffs:
            continue
        alterados += 1
        print(f"- {row['nome'][:50]}")
        for m in mudancas:
            print(f"    {m}")
        for campo, valor in diffs.items():
            print(f"    {campo}: {antes.get(campo)!r} -> {valor!r}")
        if aplicar:
            sets = ", ".join(f"{c}=%s" for c in diffs)
            cur.execute(
                f"UPDATE compras_fornecedores SET {sets} WHERE id=%s",
                [*diffs.values(), row["id"]],
            )
    if aplicar:
        conn.commit()
        print("COMMIT online ok")
    else:
        conn.rollback()
    cur.close()
    conn.close()
    return alterados


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--alvo", choices=("local", "online"), required=True)
    parser.add_argument("--aplicar", action="store_true")
    parser.add_argument(
        "--db",
        default=str(ROOT / "carecore_aeb.db"),
        help="SQLite local (padrão carecore_aeb.db)",
    )
    args = parser.parse_args()

    modo = "APLICAR" if args.aplicar else "DRY-RUN"
    print(f"[{modo}] alvo={args.alvo}")

    if args.alvo == "local":
        path = Path(args.db)
        if not path.is_absolute():
            path = ROOT / path
        print(f"db={path}")
        n = _rodar_sqlite(path, args.aplicar)
    else:
        n = _rodar_postgres(args.aplicar)

    print(f"registros_com_mudanca={n}")
    if not args.aplicar and n:
        print("Reexecute com --aplicar para gravar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
