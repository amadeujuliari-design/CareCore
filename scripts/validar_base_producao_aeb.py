"""
Valida uma base CareCore+ preparada para producao AEB.

Exemplos:
  python scripts/validar_base_producao_aeb.py --database carecore_aeb_producao_preparada_20260618.db
  python scripts/validar_base_producao_aeb.py --database carecore_aeb_producao_preparada_20260618.db --expected-ativos 222
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
EXPECTED_ALEMBIC_HEAD = "b1c2d3e4f5a6"
EXPECTED_TABLES = {
    "conviventes",
    "usuarios",
    "instituicoes",
    "organizacoes",
    "lavanderia_registros",
    "pertences_recolhidos",
    "pertences_recolhidos_baixas",
    "usuarios_passkeys",
    "suporte_chamados",
    "suporte_chamados_mensagens",
    "cobranca_ciclos",
    "cobranca_projetos_rateio",
    "cobranca_eventos_asaas",
    "cobranca_liberacoes_temporarias",
}


@dataclass
class Check:
    nome: str
    ok: bool
    detalhe: str


def resolver_path(valor: str | Path) -> Path:
    path = Path(valor).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path.resolve()


def scalar(cur: sqlite3.Cursor, sql: str, params: tuple = ()):
    return cur.execute(sql, params).fetchone()[0]


def table_exists(cur: sqlite3.Cursor, table: str) -> bool:
    return bool(
        cur.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
    )


def column_exists(cur: sqlite3.Cursor, table: str, column: str) -> bool:
    return bool(
        cur.execute(
            f"SELECT 1 FROM pragma_table_info('{table}') WHERE name = ?",
            (column,),
        ).fetchone()
    )


def validar(database: Path, expected_ativos: int | None) -> list[Check]:
    checks: list[Check] = []
    con = sqlite3.connect(str(database))
    try:
        cur = con.cursor()

        integrity = scalar(cur, "PRAGMA integrity_check")
        checks.append(Check("integrity_check", integrity == "ok", str(integrity)))

        alembic = scalar(cur, "SELECT version_num FROM alembic_version")
        checks.append(Check("alembic_head", alembic == EXPECTED_ALEMBIC_HEAD, str(alembic)))

        tabelas = {
            row[0]
            for row in cur.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }
        faltantes = sorted(EXPECTED_TABLES - tabelas)
        checks.append(Check("tabelas_obrigatorias", not faltantes, f"faltantes={faltantes}"))
        checks.append(Check("total_tabelas", len(tabelas) >= 39, str(len(tabelas))))

        checks.append(Check("usuarios_token_version", column_exists(cur, "usuarios", "token_version"), "usuarios.token_version"))

        instituicoes = scalar(cur, "SELECT COUNT(*) FROM instituicoes")
        organizacoes = scalar(cur, "SELECT COUNT(*) FROM organizacoes")
        usuarios = scalar(cur, "SELECT COUNT(*) FROM usuarios")
        checks.append(Check("instituicoes", instituicoes == 1, str(instituicoes)))
        checks.append(Check("organizacoes", organizacoes == 1, str(organizacoes)))
        checks.append(Check("usuarios", usuarios > 0, str(usuarios)))

        total_conviventes = scalar(cur, "SELECT COUNT(*) FROM conviventes")
        ativos = scalar(cur, "SELECT COUNT(*) FROM conviventes WHERE status = 'Ativo'")
        inativados = scalar(cur, "SELECT COUNT(*) FROM conviventes WHERE status = 'Inativado'")
        ativos_sem_sisa = scalar(
            cur,
            """
            SELECT COUNT(*)
            FROM conviventes
            WHERE status = 'Ativo'
              AND (numero_sisa IS NULL OR TRIM(numero_sisa) = '')
            """,
        )
        ativos_sisa_distintos = scalar(
            cur,
            "SELECT COUNT(DISTINCT numero_sisa) FROM conviventes WHERE status = 'Ativo'",
        )
        duplicados_sisa_ativos = scalar(
            cur,
            """
            SELECT COUNT(*)
            FROM (
                SELECT numero_sisa
                FROM conviventes
                WHERE status = 'Ativo'
                  AND numero_sisa IS NOT NULL
                  AND TRIM(numero_sisa) <> ''
                GROUP BY numero_sisa
                HAVING COUNT(*) > 1
            )
            """,
        )

        checks.append(Check("total_conviventes", total_conviventes > 0, str(total_conviventes)))
        checks.append(Check("ativos", ativos > 0, str(ativos)))
        checks.append(Check("inativados", inativados > 0, str(inativados)))
        checks.append(Check("ativos_sem_sisa", ativos_sem_sisa == 0, str(ativos_sem_sisa)))
        checks.append(Check("ativos_sisa_distintos", ativos_sisa_distintos == ativos, f"{ativos_sisa_distintos}/{ativos}"))
        checks.append(Check("duplicados_sisa_ativos", duplicados_sisa_ativos == 0, str(duplicados_sisa_ativos)))

        if expected_ativos is not None:
            checks.append(Check("expected_ativos", ativos == expected_ativos, f"{ativos}/{expected_ativos}"))

        leitos_ocupados_inativos = scalar(
            cur,
            """
            SELECT COUNT(*)
            FROM conviventes
            WHERE status <> 'Ativo'
              AND leito_id IS NOT NULL
            """,
        )
        checks.append(Check("inativos_sem_leito", leitos_ocupados_inativos == 0, str(leitos_ocupados_inativos)))

        return checks
    finally:
        con.close()


def imprimir(checks: list[Check]) -> None:
    for check in checks:
        status = "OK" if check.ok else "FALHA"
        print(f"{status};{check.nome};{check.detalhe}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida base de producao AEB.")
    parser.add_argument("--database", required=True, help="SQLite preparado")
    parser.add_argument("--expected-ativos", type=int, default=None, help="Total esperado de ativos")
    args = parser.parse_args()

    database = resolver_path(args.database)
    if not database.exists():
        raise FileNotFoundError(f"Banco nao encontrado: {database}")

    checks = validar(database, args.expected_ativos)
    imprimir(checks)

    if not all(check.ok for check in checks):
        sys.exit(1)


if __name__ == "__main__":
    main()
