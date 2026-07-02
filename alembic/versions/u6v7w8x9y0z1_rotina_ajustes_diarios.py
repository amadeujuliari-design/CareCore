"""Ajustes manuais de totais diários da rotina

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-06-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "u6v7w8x9y0z1"
down_revision: Union[str, None] = "t5u6v7w8x9y0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "rotina_ajustes_diarios" in inspector.get_table_names():
        return

    op.create_table(
        "rotina_ajustes_diarios",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("data_referencia", sa.Date(), nullable=False),
        sa.Column("tipo_registro", sa.String(), nullable=False),
        sa.Column("quantidade_ajuste", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("justificativa", sa.Text(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "instituicao_id",
            "data_referencia",
            "tipo_registro",
            name="uq_rotina_ajuste_diario_inst_data_tipo",
        ),
    )
    op.create_index(
        "ix_rotina_ajustes_diarios_instituicao_id",
        "rotina_ajustes_diarios",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_rotina_ajustes_diarios_data_referencia",
        "rotina_ajustes_diarios",
        ["data_referencia"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "rotina_ajustes_diarios" not in inspector.get_table_names():
        return
    op.drop_index("ix_rotina_ajustes_diarios_data_referencia", table_name="rotina_ajustes_diarios")
    op.drop_index("ix_rotina_ajustes_diarios_instituicao_id", table_name="rotina_ajustes_diarios")
    op.drop_table("rotina_ajustes_diarios")
