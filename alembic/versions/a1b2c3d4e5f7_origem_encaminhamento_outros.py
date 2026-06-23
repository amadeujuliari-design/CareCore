"""Texto livre para origem de encaminhamento quando não está na lista.

Revision ID: a1b2c3d4e5f7
Revises: f9b2c3d4e5f6
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f7"
down_revision = "f9b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conviventes",
        sa.Column("origem_encaminhamento_outros", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conviventes", "origem_encaminhamento_outros")
