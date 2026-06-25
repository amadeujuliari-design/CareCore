"""Campos de datas cadastrais e prontuário da saúde — conviventes

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l6m7n8o9p0q1"
down_revision: Union[str, None] = "k5l6m7n8o9p0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {col["name"] for col in inspector.get_columns("conviventes")}

    if "data_inclusao" not in colunas:
        op.add_column("conviventes", sa.Column("data_inclusao", sa.Date(), nullable=True))
    if "data_inativacao" not in colunas:
        op.add_column("conviventes", sa.Column("data_inativacao", sa.Date(), nullable=True))
    if "data_nova_vinculacao" not in colunas:
        op.add_column("conviventes", sa.Column("data_nova_vinculacao", sa.Date(), nullable=True))
    if "prontuario_saude" not in colunas:
        op.add_column("conviventes", sa.Column("prontuario_saude", sa.String(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE conviventes
            SET data_inclusao = data_entrada
            WHERE data_inclusao IS NULL AND data_entrada IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE conviventes
            SET data_inativacao = date(inativado_em)
            WHERE data_inativacao IS NULL AND inativado_em IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {col["name"] for col in inspector.get_columns("conviventes")}

    if "prontuario_saude" in colunas:
        op.drop_column("conviventes", "prontuario_saude")
    if "data_nova_vinculacao" in colunas:
        op.drop_column("conviventes", "data_nova_vinculacao")
    if "data_inativacao" in colunas:
        op.drop_column("conviventes", "data_inativacao")
    if "data_inclusao" in colunas:
        op.drop_column("conviventes", "data_inclusao")
