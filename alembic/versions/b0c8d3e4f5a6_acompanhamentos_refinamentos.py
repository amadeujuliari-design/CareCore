"""acompanhamentos refinamentos

Revision ID: b0c8d3e4f5a6
Revises: a9c4e1f2b7d3
Create Date: 2026-06-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b0c8d3e4f5a6"
down_revision: Union[str, None] = "a9c4e1f2b7d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "acompanhamentos_suspensoes_provisorias",
        sa.Column("status_aplicado", sa.String(), nullable=True),
    )
    op.add_column(
        "acompanhamentos_discussoes_hospitalares",
        sa.Column("hospital_outro", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("acompanhamentos_discussoes_hospitalares", "hospital_outro")
    op.drop_column("acompanhamentos_suspensoes_provisorias", "status_aplicado")
