"""limpeza importacao diarios historico

Revision ID: c9e3a1b5d7f0
Revises: b8f1a7c2d4e9
Create Date: 2026-06-06 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c9e3a1b5d7f0"
down_revision: Union[str, Sequence[str], None] = "b8f1a7c2d4e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS importacao_diarios_historico")


def downgrade() -> None:
    pass
