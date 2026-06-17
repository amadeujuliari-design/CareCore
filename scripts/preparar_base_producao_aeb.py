"""
Prepara a base AEB para virada de producao.

Fluxo:
  1. Copia o backup congelado para uma base operacional.
  2. Roda Alembic ate a head atual.
  3. Roda a importacao do relatorio SISA em dry-run ou execucao real.
  4. Valida invariantes da base preparada.

Exemplos:
  python scripts/preparar_base_producao_aeb.py --source-xls "C:\\Users\\user\\Downloads\\RelatorioCidadaoVinculado (1).xls"
  python scripts/preparar_base_producao_aeb.py --source-xls "C:\\Users\\user\\Downloads\\RelatorioCidadaoVinculado (1).xls" --yes
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_BASE_DB = ROOT_DIR / "backups" / "carecore_aeb_backup_validacao_sistema_20260607_102124.db"
DEFAULT_OUTPUT_DB = ROOT_DIR / "carecore_aeb_producao_preparada_20260618.db"
IMPORT_SCRIPT = ROOT_DIR / "scripts" / "importar_conviventes_sisa_vinculados.py"
EXPECTED_ALEMBIC_HEAD = "b1c2d3e4f5a6"


@dataclass(frozen=True)
class ValidacaoBase:
    alembic_version: str
    total_tabelas: int
    total_conviventes: int
    ativos: int
    inativados: int
    ativos_sem_sisa: int
    ativos_sisa_distintos: int
    duplicados_sisa_ativos: int


def resolver_path(valor: str | Path) -> Path:
    path = Path(valor).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path.resolve()


def executar(comando: list[str], env: dict[str, str] | None = None) -> None:
    print("+", " ".join(f'"{item}"' if " " in item else item for item in comando))
    subprocess.run(comando, cwd=ROOT_DIR, env=env, check=True)


def copiar_base(base_db: Path, output_db: Path, overwrite: bool) -> None:
    if not base_db.exists():
        raise FileNotFoundError(f"Backup base nao encontrado: {base_db}")

    if output_db.exists() and not overwrite:
        raise FileExistsError(
            f"Base operacional ja existe: {output_db}. "
            "Use --overwrite para recriar."
        )

    output_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(base_db, output_db)
    print(f"Base operacional criada: {output_db}")


def rodar_migrations(output_db: Path) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{output_db.as_posix()}"
    executar(["alembic", "current"], env=env)
    executar(["alembic", "upgrade", "head"], env=env)
    executar(["alembic", "current"], env=env)


def rodar_importacao(source_xls: Path, output_db: Path, executar_real: bool) -> None:
    comando = [
        sys.executable,
        str(IMPORT_SCRIPT),
        "--source-xls",
        str(source_xls),
        "--database",
        str(output_db),
    ]
    if executar_real:
        comando.append("--yes")
    executar(comando)


def validar_base(output_db: Path, exigir_importacao: bool) -> ValidacaoBase:
    con = sqlite3.connect(str(output_db))
    try:
        cur = con.cursor()
        integrity = cur.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"integrity_check falhou: {integrity}")

        alembic_version = cur.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        total_tabelas = cur.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        total_conviventes = cur.execute("SELECT COUNT(*) FROM conviventes").fetchone()[0]
        ativos = cur.execute("SELECT COUNT(*) FROM conviventes WHERE status = 'Ativo'").fetchone()[0]
        inativados = cur.execute("SELECT COUNT(*) FROM conviventes WHERE status = 'Inativado'").fetchone()[0]
        ativos_sem_sisa = cur.execute(
            """
            SELECT COUNT(*)
            FROM conviventes
            WHERE status = 'Ativo'
              AND (numero_sisa IS NULL OR TRIM(numero_sisa) = '')
            """
        ).fetchone()[0]
        ativos_sisa_distintos = cur.execute(
            "SELECT COUNT(DISTINCT numero_sisa) FROM conviventes WHERE status = 'Ativo'"
        ).fetchone()[0]
        duplicados_sisa_ativos = cur.execute(
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
            """
        ).fetchone()[0]

        validacao = ValidacaoBase(
            alembic_version=alembic_version,
            total_tabelas=total_tabelas,
            total_conviventes=total_conviventes,
            ativos=ativos,
            inativados=inativados,
            ativos_sem_sisa=ativos_sem_sisa,
            ativos_sisa_distintos=ativos_sisa_distintos,
            duplicados_sisa_ativos=duplicados_sisa_ativos,
        )

        if alembic_version != EXPECTED_ALEMBIC_HEAD:
            raise RuntimeError(f"Alembic divergente: {alembic_version} != {EXPECTED_ALEMBIC_HEAD}")
        if total_tabelas < 39:
            raise RuntimeError(f"Quantidade de tabelas menor que esperado: {total_tabelas}")
        if exigir_importacao:
            if ativos <= 0:
                raise RuntimeError("Nenhum convivente ativo apos importacao.")
            if ativos_sem_sisa:
                raise RuntimeError(f"Existem {ativos_sem_sisa} ativos sem numero_sisa.")
            if ativos_sisa_distintos != ativos:
                raise RuntimeError("Total de SISA distintos nao bate com total de ativos.")
            if duplicados_sisa_ativos:
                raise RuntimeError(f"Existem {duplicados_sisa_ativos} numeros SISA duplicados entre ativos.")

        return validacao
    finally:
        con.close()


def imprimir_validacao(validacao: ValidacaoBase) -> None:
    print("Validacao da base preparada:")
    print(f"- alembic_version: {validacao.alembic_version}")
    print(f"- total_tabelas: {validacao.total_tabelas}")
    print(f"- total_conviventes: {validacao.total_conviventes}")
    print(f"- ativos: {validacao.ativos}")
    print(f"- inativados: {validacao.inativados}")
    print(f"- ativos_sem_sisa: {validacao.ativos_sem_sisa}")
    print(f"- ativos_sisa_distintos: {validacao.ativos_sisa_distintos}")
    print(f"- duplicados_sisa_ativos: {validacao.duplicados_sisa_ativos}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepara base AEB para producao.")
    parser.add_argument("--source-xls", required=True, help="Relatorio SISA Cidadaos Vinculados .xls")
    parser.add_argument("--base-db", default=str(DEFAULT_BASE_DB), help="Backup congelado de origem")
    parser.add_argument("--output-db", default=str(DEFAULT_OUTPUT_DB), help="Base operacional gerada")
    parser.add_argument("--overwrite", action="store_true", help="Recria output-db se ja existir")
    parser.add_argument("--yes", action="store_true", help="Executa importacao real; sem isso importa em dry-run")
    args = parser.parse_args()

    source_xls = resolver_path(args.source_xls)
    base_db = resolver_path(args.base_db)
    output_db = resolver_path(args.output_db)

    if not source_xls.exists():
        raise FileNotFoundError(f"Relatorio SISA nao encontrado: {source_xls}")

    print("Modo:", "EXECUCAO REAL" if args.yes else "DRY-RUN")
    copiar_base(base_db, output_db, overwrite=args.overwrite)
    rodar_migrations(output_db)
    rodar_importacao(source_xls, output_db, executar_real=args.yes)
    validacao = validar_base(output_db, exigir_importacao=args.yes)
    imprimir_validacao(validacao)

    if not args.yes:
        print("Dry-run concluido. A base operacional foi criada para validacao, mas a importacao nao gravou dados.")
    else:
        print("Base de producao preparada com sucesso.")


if __name__ == "__main__":
    main()
