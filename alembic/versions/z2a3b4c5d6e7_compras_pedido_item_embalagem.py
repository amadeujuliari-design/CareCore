"""Pedido de consumo: embalagem da linha (snapshot), independente do cadastro.

Revision ID: z2a3b4c5d6e7
Revises: y1z2a3b4c5d6
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "z2a3b4c5d6e7"
down_revision: Union[str, None] = "y1z2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedido_itens" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_pedido_itens")}
    if "embalagem" not in cols:
        op.add_column("compras_pedido_itens", sa.Column("embalagem", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("compras_pedido_itens") as batch:
        batch.drop_column("embalagem")
