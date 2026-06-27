"""Marca refeições extras com Rep1, Rep2... na rotina

Revision ID: p1q2r3s4t5u6
Revises: o0p1q2r3s4t5
Create Date: 2026-06-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p1q2r3s4t5u6"
down_revision: Union[str, None] = "o0p1q2r3s4t5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {col["name"] for col in inspector.get_columns("registros_rotina")}
    if "repeticao_extra_refeicao" not in colunas:
        op.add_column(
            "registros_rotina",
            sa.Column("repeticao_extra_refeicao", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {col["name"] for col in inspector.get_columns("registros_rotina")}
    if "repeticao_extra_refeicao" in colunas:
        op.drop_column("registros_rotina", "repeticao_extra_refeicao")
