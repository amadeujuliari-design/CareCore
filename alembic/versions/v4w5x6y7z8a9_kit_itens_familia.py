"""Itens do kit entregues uma vez por família.

Revision ID: v4w5x6y7z8a9
Revises: u3v4w5x6y7z8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v4w5x6y7z8a9"
down_revision: Union[str, None] = "u3v4w5x6y7z8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "kit_higiene_itens_familia" in inspector.get_table_names():
        return
    op.create_table(
        "kit_higiene_itens_familia",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("instituicao_id", "nome", name="uq_kit_higiene_item_familia"),
    )
    op.create_index(
        "ix_kit_higiene_itens_familia_instituicao_id",
        "kit_higiene_itens_familia",
        ["instituicao_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "kit_higiene_itens_familia" not in inspector.get_table_names():
        return
    op.drop_index("ix_kit_higiene_itens_familia_instituicao_id", table_name="kit_higiene_itens_familia")
    op.drop_table("kit_higiene_itens_familia")
