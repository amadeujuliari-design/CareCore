"""Flag cobranca_ativa por instituição (excluir do rateio quando desligada).

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-08-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instituicoes" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("instituicoes")}
    if "cobranca_ativa" in cols:
        return
    op.add_column(
        "instituicoes",
        sa.Column(
            "cobranca_ativa",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instituicoes" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("instituicoes")}
    if "cobranca_ativa" not in cols:
        return
    op.drop_column("instituicoes", "cobranca_ativa")
