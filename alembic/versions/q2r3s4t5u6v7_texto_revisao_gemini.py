"""Campos de texto original e contador mensal de revisão por IA

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-06-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q2r3s4t5u6v7"
down_revision: Union[str, None] = "p1q2r3s4t5u6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _adicionar_coluna_se_ausente(tabela: str, coluna: sa.Column) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas = {item["name"] for item in inspector.get_columns(tabela)}
    if coluna.name not in colunas:
        op.add_column(tabela, coluna)


def upgrade() -> None:
    _adicionar_coluna_se_ausente(
        "ocorrencias_conviventes",
        sa.Column("motivo_original", sa.Text(), nullable=True),
    )
    _adicionar_coluna_se_ausente(
        "ocorrencias_conviventes",
        sa.Column("descricao_original", sa.Text(), nullable=True),
    )
    _adicionar_coluna_se_ausente(
        "interacoes_ocorrencias",
        sa.Column("mensagem_original", sa.Text(), nullable=True),
    )
    _adicionar_coluna_se_ausente(
        "avisos",
        sa.Column("titulo_original", sa.Text(), nullable=True),
    )
    _adicionar_coluna_se_ausente(
        "avisos",
        sa.Column("mensagem_original", sa.Text(), nullable=True),
    )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "texto_revisao_uso_mensal" not in inspector.get_table_names():
        op.create_table(
            "texto_revisao_uso_mensal",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("ano", sa.Integer(), nullable=False),
            sa.Column("mes", sa.Integer(), nullable=False),
            sa.Column("contagem", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("instituicao_id", "ano", "mes", name="uq_texto_revisao_uso_mensal"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "texto_revisao_uso_mensal" in inspector.get_table_names():
        op.drop_table("texto_revisao_uso_mensal")

    for tabela, coluna in [
        ("avisos", "mensagem_original"),
        ("avisos", "titulo_original"),
        ("interacoes_ocorrencias", "mensagem_original"),
        ("ocorrencias_conviventes", "descricao_original"),
        ("ocorrencias_conviventes", "motivo_original"),
    ]:
        colunas = {item["name"] for item in inspector.get_columns(tabela)}
        if coluna in colunas:
            op.drop_column(tabela, coluna)
