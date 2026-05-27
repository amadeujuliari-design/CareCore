# =====================================================================
# SCRIPT: atualizar_fechamento_reabertura_local.py
# Adiciona campos de auditoria de reabertura no banco SQLite local.
# Seguro para rodar mais de uma vez.
# =====================================================================
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "carecore_local.db"

COLUNAS = {
    "reaberto_por_id": "TEXT",
    "reaberto_em": "DATETIME",
    "motivo_reabertura": "TEXT",
}

def coluna_existe(cursor, tabela, coluna):
    cursor.execute(f"PRAGMA table_info({tabela})")
    return any(row[1] == coluna for row in cursor.fetchall())

def main():
    if not DB_PATH.exists():
        raise SystemExit(f"Banco não encontrado: {DB_PATH}")

    print(f"Banco: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for coluna, tipo in COLUNAS.items():
        if coluna_existe(cursor, "fechamentos_mensais", coluna):
            print(f"Coluna já existe: {coluna}")
            continue

        print(f"Adicionando coluna: {coluna}")
        cursor.execute(f"ALTER TABLE fechamentos_mensais ADD COLUMN {coluna} {tipo}")

    conn.commit()
    conn.close()

    print("SUCESSO: campos de reabertura de fechamento atualizados.")

if __name__ == "__main__":
    main()
