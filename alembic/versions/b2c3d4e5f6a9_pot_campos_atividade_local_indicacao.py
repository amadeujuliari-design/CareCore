"""Campos POT alinhados a planilha (atividade, local, indicacao)

Revision ID: b2c3d4e5f6a9
Revises: a1b2c3d4e5f8
Create Date: 2026-07-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a9"
down_revision: Union[str, None] = "a1b2c3d4e5f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "acompanhamentos_pot" not in set(inspector.get_table_names()):
        return

    colunas = {c["name"] for c in inspector.get_columns("acompanhamentos_pot")}
    if "atividade" not in colunas:
        op.add_column("acompanhamentos_pot", sa.Column("atividade", sa.Text(), nullable=True))
    if "local" not in colunas:
        op.add_column("acompanhamentos_pot", sa.Column("local", sa.String(), nullable=True))
    if "indicacao" not in colunas:
        op.add_column("acompanhamentos_pot", sa.Column("indicacao", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "acompanhamentos_pot" not in set(inspector.get_table_names()):
        return

    colunas = {c["name"] for c in inspector.get_columns("acompanhamentos_pot")}
    if "indicacao" in colunas:
        op.drop_column("acompanhamentos_pot", "indicacao")
    if "local" in colunas:
        op.drop_column("acompanhamentos_pot", "local")
    if "atividade" in colunas:
        op.drop_column("acompanhamentos_pot", "atividade")
