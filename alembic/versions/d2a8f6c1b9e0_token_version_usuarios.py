"""token version usuarios

Revision ID: d2a8f6c1b9e0
Revises: c9e3a1b5d7f0
Create Date: 2026-06-07 23:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2a8f6c1b9e0"
down_revision: Union[str, Sequence[str], None] = "c9e3a1b5d7f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {coluna["name"] for coluna in inspector.get_columns("usuarios")}

    if "token_version" in colunas:
        return

    op.add_column(
        "usuarios",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )

    if bind.dialect.name == "sqlite":
        return

    op.alter_column("usuarios", "token_version", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {coluna["name"] for coluna in inspector.get_columns("usuarios")}

    if "token_version" not in colunas:
        return

    op.drop_column("usuarios", "token_version")
