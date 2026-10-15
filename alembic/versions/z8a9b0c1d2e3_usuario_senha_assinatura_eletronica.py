"""Senha de assinatura eletrônica do gestor.

Revision ID: z8a9b0c1d2e3
Revises: y7z8a9b0c1d2
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "z8a9b0c1d2e3"
down_revision: Union[str, None] = "y7z8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("usuarios")}
    if "assinatura_eletronica_senha_hash" not in cols:
        op.add_column(
            "usuarios",
            sa.Column("assinatura_eletronica_senha_hash", sa.String(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "usuarios" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("usuarios")}
    if "assinatura_eletronica_senha_hash" in cols:
        op.drop_column("usuarios", "assinatura_eletronica_senha_hash")
