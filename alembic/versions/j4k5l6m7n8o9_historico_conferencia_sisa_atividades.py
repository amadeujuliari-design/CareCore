"""Histórico de conferências SISA — módulo Atividades

Revision ID: j4k5l6m7n8o9
Revises: i3c4d5e6f7a9
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, None] = "i3c4d5e6f7a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "atividade_sisa_conferencias_historico" in inspector.get_table_names():
        return

    op.create_table(
        "atividade_sisa_conferencias_historico",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("nome_arquivo", sa.String(), nullable=False),
        sa.Column("data_inicio_referencia", sa.Date(), nullable=False),
        sa.Column("data_fim_referencia", sa.Date(), nullable=False),
        sa.Column("servico", sa.String(), nullable=True),
        sa.Column("projeto", sa.String(), nullable=True),
        sa.Column("conferidas", sa.Integer(), nullable=True),
        sa.Column("divergencias_quantidade", sa.Integer(), nullable=True),
        sa.Column("sem_vinculo", sa.Integer(), nullable=True),
        sa.Column("sem_ocorrencia_carecore", sa.Integer(), nullable=True),
        sa.Column("somente_carecore", sa.Integer(), nullable=True),
        sa.Column("total_linhas_sisa", sa.Integer(), nullable=True),
        sa.Column("resultado_json", sa.Text(), nullable=False),
        sa.Column("vinculos_json", sa.Text(), nullable=True),
        sa.Column("importado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_atividade_sisa_conf_hist_instituicao_data",
        "atividade_sisa_conferencias_historico",
        ["instituicao_id", "importado_em"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "atividade_sisa_conferencias_historico" not in inspector.get_table_names():
        return
    op.drop_index("ix_atividade_sisa_conf_hist_instituicao_data", table_name="atividade_sisa_conferencias_historico")
    op.drop_table("atividade_sisa_conferencias_historico")
