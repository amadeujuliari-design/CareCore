"""Família, kit de higiene e agenda de lavanderia do Reencontro Pari.

Revision ID: p8q9r0s1t2u3
Revises: o7p8q9r0s1t2
Create Date: 2026-09-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p8q9r0s1t2u3"
down_revision: Union[str, None] = "o7p8q9r0s1t2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "familias_convivente" not in tabelas:
        op.create_table(
            "familias_convivente",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("codigo", sa.String(), nullable=False),
            sa.UniqueConstraint("instituicao_id", "codigo", name="uq_familia_convivente_codigo"),
        )
        op.create_index("ix_familias_convivente_instituicao", "familias_convivente", ["instituicao_id"])

    colunas_convivente = _colunas(inspector, "conviventes")
    novas = {
        "familia_id": sa.Column("familia_id", sa.String(), nullable=True),
        "tipo_individuo": sa.Column("tipo_individuo", sa.String(), nullable=True),
        "retira_alimentacao": sa.Column("retira_alimentacao", sa.Boolean(), nullable=False, server_default=sa.true()),
        "ubs_referencia": sa.Column("ubs_referencia", sa.String(), nullable=True),
        "unidade_escolar": sa.Column("unidade_escolar", sa.String(), nullable=True),
        "motivo_saida": sa.Column("motivo_saida", sa.Text(), nullable=True),
        "sexo": sa.Column("sexo", sa.String(), nullable=True),
        "motivo_procura": sa.Column("motivo_procura", sa.Text(), nullable=True),
    }
    for nome, coluna in novas.items():
        if nome not in colunas_convivente and "conviventes" in tabelas:
            op.add_column("conviventes", coluna)

    if "tipos_individuo_higiene" not in tabelas:
        op.create_table(
            "tipos_individuo_higiene",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("descricao", sa.String(), nullable=True),
            sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.UniqueConstraint("instituicao_id", "nome", name="uq_tipo_individuo_higiene_nome"),
        )
    if "itens_higiene" not in tabelas:
        op.create_table(
            "itens_higiene",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    if "kit_higiene_regras" not in tabelas:
        op.create_table(
            "kit_higiene_regras",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("item_id", sa.String(), sa.ForeignKey("itens_higiene.id"), nullable=False),
            sa.Column("tipo_id", sa.String(), sa.ForeignKey("tipos_individuo_higiene.id"), nullable=False),
            sa.Column("quantidade", sa.Integer(), nullable=False, server_default="1"),
            sa.UniqueConstraint("item_id", "tipo_id", name="uq_kit_higiene_item_tipo"),
        )
    if "kit_higiene_entregas" not in tabelas:
        op.create_table(
            "kit_higiene_entregas",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("familia_id", sa.String(), sa.ForeignKey("familias_convivente.id"), nullable=False),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("convivente_id", sa.String(), sa.ForeignKey("conviventes.id"), nullable=False),
            sa.Column("entregue_em", sa.DateTime(), nullable=False),
            sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("composicao", sa.Text(), nullable=True),
            sa.UniqueConstraint("familia_id", "competencia", name="uq_kit_higiene_familia_mes"),
        )
    if "lavanderia_agenda" not in tabelas:
        op.create_table(
            "lavanderia_agenda",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("maquina", sa.String(), nullable=False),
            sa.Column("inicio", sa.DateTime(), nullable=False),
            sa.Column("fim", sa.DateTime(), nullable=False),
            sa.Column("convivente_id", sa.String(), sa.ForeignKey("conviventes.id"), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="agendado"),
            sa.Column("liberado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("instituicao_id", "maquina", "inicio", name="uq_lavanderia_agenda_slot"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    for tabela in (
        "lavanderia_agenda",
        "kit_higiene_entregas",
        "kit_higiene_regras",
        "itens_higiene",
        "tipos_individuo_higiene",
    ):
        if tabela in tabelas:
            op.drop_table(tabela)
    colunas = _colunas(inspector, "conviventes")
    for nome in (
        "motivo_procura",
        "sexo",
        "motivo_saida",
        "unidade_escolar",
        "ubs_referencia",
        "retira_alimentacao",
        "tipo_individuo",
        "familia_id",
    ):
        if nome in colunas:
            op.drop_column("conviventes", nome)
    if "familias_convivente" in tabelas:
        op.drop_table("familias_convivente")
