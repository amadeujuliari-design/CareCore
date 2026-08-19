"""Cadastro de itens de consumo: campo embalagem.

Revision ID: y1z2a3b4c5d6
Revises: x0y1z2a3b4c5
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "y1z2a3b4c5d6"
down_revision: Union[str, None] = "x0y1z2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_itens_consumo" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_itens_consumo")}
    if "embalagem" not in cols:
        op.add_column("compras_itens_consumo", sa.Column("embalagem", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("compras_itens_consumo") as batch:
        batch.drop_column("embalagem")
