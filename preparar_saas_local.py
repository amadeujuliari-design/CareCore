"""
Script local seguro para preparar o banco SQLite atual para o futuro SaaS.

O que faz:
- cria colunas de assinatura/licenciamento em instituicoes, se ainda não existirem;
- não apaga dados;
- pode ser executado mais de uma vez.

Como usar, com o backend parado:
    python preparar_saas_local.py
"""

import sqlite3
from pathlib import Path


BANCO = Path(__file__).resolve().parent / "carecore_local.db"


COLUNAS = {
    "status_assinatura": "TEXT DEFAULT 'Ativa'",
    "data_vencimento": "DATE",
    "bloqueado": "BOOLEAN DEFAULT 0",
    "bloqueado_em": "DATETIME",
    "dias_tolerancia": "INTEGER DEFAULT 5",
    "plano": "TEXT DEFAULT 'Mensal'",
}


def coluna_existe(cursor, tabela: str, coluna: str) -> bool:
    cursor.execute(f"PRAGMA table_info({tabela})")
    return any(linha[1] == coluna for linha in cursor.fetchall())


def main():
    if not BANCO.exists():
        raise SystemExit(f"Banco não encontrado: {BANCO}")

    conexao = sqlite3.connect(BANCO)
    cursor = conexao.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='instituicoes'")
    if not cursor.fetchone():
        conexao.close()
        raise SystemExit("Tabela instituicoes não encontrada.")

    alteradas = []

    for coluna, definicao in COLUNAS.items():
        if not coluna_existe(cursor, "instituicoes", coluna):
            cursor.execute(f"ALTER TABLE instituicoes ADD COLUMN {coluna} {definicao}")
            alteradas.append(coluna)

    conexao.commit()
    conexao.close()

    if alteradas:
        print("✅ Banco preparado. Colunas adicionadas:")
        for coluna in alteradas:
            print(f" - {coluna}")
    else:
        print("✅ Banco já estava preparado. Nenhuma alteração necessária.")


if __name__ == "__main__":
    main()
