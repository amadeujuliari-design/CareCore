"""Corrige data_inativacao gravada como inteiro (ano) no SQLite

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-06-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m7n8o9p0q1r2"
down_revision: Union[str, None] = "l6m7n8o9p0q1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CAST(inativado_em AS DATE) no SQLite retorna o ano como inteiro, não AAAA-MM-DD.
    op.execute(
        sa.text(
            """
            UPDATE conviventes
            SET data_inativacao = date(inativado_em)
            WHERE data_inativacao IS NOT NULL
              AND typeof(data_inativacao) != 'text'
              AND inativado_em IS NOT NULL
              AND date(inativado_em) IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE conviventes
            SET data_inativacao = NULL
            WHERE data_inativacao IS NOT NULL
              AND (
                typeof(data_inativacao) != 'text'
                OR length(CAST(data_inativacao AS TEXT)) < 10
              )
            """
        )
    )


def downgrade() -> None:
    pass
