"""Contato livre do fornecedor na cotacao do projeto.

Revision ID: b1c2d3e4f5a6
Revises: b0c1d2e3f4a5
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "b0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_cotacoes" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_cotacoes")}
    if "fornecedor_contato" not in cols:
        op.add_column("compras_cotacoes", sa.Column("fornecedor_contato", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_cotacoes" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_cotacoes")}
    if "fornecedor_contato" in cols:
        op.drop_column("compras_cotacoes", "fornecedor_contato")
