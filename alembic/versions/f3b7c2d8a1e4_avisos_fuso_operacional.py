"""avisos fuso operacional

Revision ID: f3b7c2d8a1e4
Revises: b1c2d3e4f5a6
Create Date: 2026-06-19 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3b7c2d8a1e4"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ajustar_coluna(tabela: str, coluna: str, delta_horas: int) -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        sinal = f"-{delta_horas} hours" if delta_horas > 0 else f"+{abs(delta_horas)} hours"
        op.execute(
            sa.text(
                f"UPDATE {tabela} "
                f"SET {coluna} = datetime({coluna}, :delta) "
                f"WHERE {coluna} IS NOT NULL"
            ).bindparams(delta=sinal)
        )
        return

    intervalo = f"interval '{delta_horas} hours'"
    if delta_horas < 0:
        intervalo = f"interval '{abs(delta_horas)} hours'"
        sql = (
            f"UPDATE {tabela} SET {coluna} = {coluna} + {intervalo} "
            f"WHERE {coluna} IS NOT NULL"
        )
    else:
        sql = (
            f"UPDATE {tabela} SET {coluna} = {coluna} - {intervalo} "
            f"WHERE {coluna} IS NOT NULL"
        )
    op.execute(sa.text(sql))


def upgrade() -> None:
    # Registros antigos foram gravados em UTC naive; o domínio passa a usar America/Sao_Paulo naive.
    for tabela, coluna in (
        ("avisos", "criado_em"),
        ("avisos", "valido_ate"),
        ("avisos", "atualizado_em"),
        ("avisos", "cancelado_em"),
        ("aviso_destinatarios", "criado_em"),
        ("aviso_destinatarios", "lido_em"),
    ):
        _ajustar_coluna(tabela, coluna, delta_horas=3)


def downgrade() -> None:
    for tabela, coluna in (
        ("avisos", "criado_em"),
        ("avisos", "valido_ate"),
        ("avisos", "atualizado_em"),
        ("avisos", "cancelado_em"),
        ("aviso_destinatarios", "criado_em"),
        ("aviso_destinatarios", "lido_em"),
    ):
        _ajustar_coluna(tabela, coluna, delta_horas=-3)
