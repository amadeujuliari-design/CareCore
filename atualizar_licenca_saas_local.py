# =====================================================================
# ARQUIVO: atualizar_licenca_saas_local.py
# Adiciona campos de licença/assinatura na tabela instituicoes (SQLite)
# =====================================================================
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "carecore_local.db"

COLUNAS = {
    "status_assinatura": "TEXT DEFAULT 'Ativa'",
    "data_vencimento": "DATE",
    "bloqueado": "BOOLEAN DEFAULT 0",
    "bloqueado_em": "DATETIME",
    "dias_tolerancia": "INTEGER DEFAULT 5",
}


def coluna_existe(cursor, tabela, coluna):
    cursor.execute(f"PRAGMA table_info({tabela})")
    return any(linha[1] == coluna for linha in cursor.fetchall())


def main():
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Banco não encontrado: {DB_PATH}")

    print(f"Banco: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        for coluna, definicao in COLUNAS.items():
            if coluna_existe(cursor, "instituicoes", coluna):
                print(f"OK: coluna já existe: {coluna}")
                continue

            print(f"Adicionando coluna: {coluna}")
            cursor.execute(f"ALTER TABLE instituicoes ADD COLUMN {coluna} {definicao}")

        # Garante valores padrão para instituições já existentes.
        cursor.execute("""
            UPDATE instituicoes
            SET
                status_assinatura = COALESCE(status_assinatura, 'Ativa'),
                bloqueado = COALESCE(bloqueado, 0),
                dias_tolerancia = COALESCE(dias_tolerancia, 5)
        """)

        conn.commit()
        print("SUCESSO: campos SaaS/licença atualizados.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
