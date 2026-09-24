"""Usuário: flag para ver o módulo NFP no projeto.

Revision ID: o7p8q9r0s1t2
Revises: n6o7p8q9r0s1
Create Date: 2026-09-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o7p8q9r0s1t2"
down_revision: Union[str, None] = "n6o7p8q9r0s1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    colunas = {coluna["name"] for coluna in inspector.get_columns("usuarios")}
    if "nfp_modulo_ativo" in colunas:
        return
    op.add_column(
        "usuarios",
        sa.Column("nfp_modulo_ativo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    colunas = {coluna["name"] for coluna in inspector.get_columns("usuarios")}
    if "nfp_modulo_ativo" not in colunas:
        return
    op.drop_column("usuarios", "nfp_modulo_ativo")
