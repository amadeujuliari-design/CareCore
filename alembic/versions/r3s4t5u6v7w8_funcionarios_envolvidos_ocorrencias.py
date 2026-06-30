"""Funcionários envolvidos em ocorrências

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-06-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "r3s4t5u6v7w8"
down_revision: Union[str, None] = "q2r3s4t5u6v7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "funcionarios_envolvidos_ocorrencias" not in inspector.get_table_names():
        op.create_table(
            "funcionarios_envolvidos_ocorrencias",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("ocorrencia_id", sa.String(), nullable=False),
            sa.Column("usuario_id", sa.String(), nullable=False),
            sa.Column("data_marcacao", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["ocorrencia_id"], ["ocorrencias_conviventes.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "funcionarios_envolvidos_ocorrencias" in inspector.get_table_names():
        op.drop_table("funcionarios_envolvidos_ocorrencias")
