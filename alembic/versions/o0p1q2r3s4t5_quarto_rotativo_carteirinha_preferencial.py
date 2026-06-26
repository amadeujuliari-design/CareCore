"""Quarto rotativo, carteirinha provisória e convivente preferencial

Revision ID: o0p1q2r3s4t5
Revises: n8o9p0q1r2s3
Create Date: 2026-06-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o0p1q2r3s4t5"
down_revision: Union[str, None] = "n8o9p0q1r2s3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    colunas_quartos = {col["name"] for col in inspector.get_columns("quartos")}
    if "rotativo" not in colunas_quartos:
        op.add_column(
            "quartos",
            sa.Column("rotativo", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    colunas_conviventes = {col["name"] for col in inspector.get_columns("conviventes")}
    if "preferencial" not in colunas_conviventes:
        op.add_column(
            "conviventes",
            sa.Column("preferencial", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "leito_provisorio_desde" not in colunas_conviventes:
        op.add_column(
            "conviventes",
            sa.Column("leito_provisorio_desde", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    colunas_conviventes = {col["name"] for col in inspector.get_columns("conviventes")}
    if "leito_provisorio_desde" in colunas_conviventes:
        op.drop_column("conviventes", "leito_provisorio_desde")
    if "preferencial" in colunas_conviventes:
        op.drop_column("conviventes", "preferencial")

    colunas_quartos = {col["name"] for col in inspector.get_columns("quartos")}
    if "rotativo" in colunas_quartos:
        op.drop_column("quartos", "rotativo")
