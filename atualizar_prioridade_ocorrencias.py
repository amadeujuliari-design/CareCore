import asyncio
from sqlalchemy import text
from database import engine


async def coluna_existe(conn, tabela: str, coluna: str) -> bool:
    resultado = await conn.execute(text(f"PRAGMA table_info({tabela})"))
    linhas = resultado.fetchall()
    return any(linha[1] == coluna for linha in linhas)


async def main():
    async with engine.begin() as conn:
        if not await coluna_existe(conn, "ocorrencias_conviventes", "prioridade"):
            await conn.execute(
                text(
                    "ALTER TABLE ocorrencias_conviventes "
                    "ADD COLUMN prioridade VARCHAR NOT NULL DEFAULT 'Média'"
                )
            )
            print("OK: coluna prioridade adicionada em ocorrencias_conviventes.")
        else:
            print("OK: coluna prioridade já existe.")

        await conn.execute(
            text(
                "UPDATE ocorrencias_conviventes "
                "SET prioridade = 'Média' "
                "WHERE prioridade IS NULL OR prioridade = ''"
            )
        )

        await conn.execute(
            text(
                "UPDATE ocorrencias_conviventes "
                "SET prioridade = 'Alta' "
                "WHERE prioridade = 'Crítico' OR prioridade = 'Critico'"
            )
        )

        print("OK: ocorrências antigas normalizadas.")


if __name__ == "__main__":
    asyncio.run(main())
