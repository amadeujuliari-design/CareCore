"""Pontos e resgates de brindes — módulo Atividades

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k5l6m7n8o9p0"
down_revision: Union[str, None] = "j4k5l6m7n8o9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "atividade_pontos_resgates" in inspector.get_table_names():
        return

    op.create_table(
        "atividade_pontos_resgates",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("pontos_utilizados", sa.Integer(), nullable=False),
        sa.Column("descricao_brinde", sa.String(), nullable=True),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("metodo_leitura", sa.String(), nullable=False),
        sa.Column("codigo_lido", sa.String(), nullable=True),
        sa.Column("registrado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_atividade_pontos_resgates_instituicao",
        "atividade_pontos_resgates",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_atividade_pontos_resgates_convivente",
        "atividade_pontos_resgates",
        ["convivente_id"],
    )
    op.create_index(
        "ix_atividade_pontos_resgates_registrado",
        "atividade_pontos_resgates",
        ["instituicao_id", "registrado_em"],
    )


def downgrade() -> None:
    op.drop_index("ix_atividade_pontos_resgates_registrado", table_name="atividade_pontos_resgates")
    op.drop_index("ix_atividade_pontos_resgates_convivente", table_name="atividade_pontos_resgates")
    op.drop_index("ix_atividade_pontos_resgates_instituicao", table_name="atividade_pontos_resgates")
    op.drop_table("atividade_pontos_resgates")
