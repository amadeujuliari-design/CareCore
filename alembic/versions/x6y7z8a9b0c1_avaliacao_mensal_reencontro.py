"""Avaliação mensal das Vilas Reencontro.

Revision ID: x6y7z8a9b0c1
Revises: w5x6y7z8a9b0
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "x6y7z8a9b0c1"
down_revision: Union[str, None] = "w5x6y7z8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "avaliacoes_mensais" in inspector.get_table_names():
        return
    op.create_table(
        "avaliacoes_mensais",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organizacao_id", sa.String(), nullable=True),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("numero_prontuario", sa.Integer(), nullable=False),
        sa.Column("competencia", sa.String(length=7), nullable=False),
        sa.Column("respostas_json", sa.Text(), nullable=False),
        sa.Column("sugestoes", sa.Text(), nullable=True),
        sa.Column("respondido_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "convivente_id",
            "competencia",
            name="uq_avaliacao_mensal_convivente_mes",
        ),
    )
    op.create_index(
        "ix_avaliacao_mensal_projeto_mes",
        "avaliacoes_mensais",
        ["instituicao_id", "competencia"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "avaliacoes_mensais" not in inspector.get_table_names():
        return
    op.drop_index("ix_avaliacao_mensal_projeto_mes", table_name="avaliacoes_mensais")
    op.drop_table("avaliacoes_mensais")
