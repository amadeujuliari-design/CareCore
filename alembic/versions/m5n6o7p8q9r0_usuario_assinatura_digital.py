"""Usuario: caminho do PDF de assinatura digital (Compras / Sede).

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
Create Date: 2026-09-14
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "m5n6o7p8q9r0"
down_revision: Union[str, None] = "l4m5n6o7p8q9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("usuarios")}
    if "assinatura_digital_caminho" not in cols:
        op.add_column("usuarios", sa.Column("assinatura_digital_caminho", sa.String(), nullable=True))
    if "assinatura_digital_nome" not in cols:
        op.add_column("usuarios", sa.Column("assinatura_digital_nome", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("usuarios")}
    if "assinatura_digital_nome" in cols:
        op.drop_column("usuarios", "assinatura_digital_nome")
    if "assinatura_digital_caminho" in cols:
        op.drop_column("usuarios", "assinatura_digital_caminho")
