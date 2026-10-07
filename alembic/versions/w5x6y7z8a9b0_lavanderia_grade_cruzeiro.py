"""Horários de uso da lavanderia configuráveis por projeto.

Revision ID: w5x6y7z8a9b0
Revises: v4w5x6y7z8a9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w5x6y7z8a9b0"
down_revision: Union[str, None] = "v4w5x6y7z8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instituicoes" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("instituicoes")}
    if "lavanderia_grade_json" not in existentes:
        op.add_column("instituicoes", sa.Column("lavanderia_grade_json", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instituicoes" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("instituicoes")}
    if "lavanderia_grade_json" in existentes:
        op.drop_column("instituicoes", "lavanderia_grade_json")
