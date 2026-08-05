"""Migration: agentes captadores NFP + campos de cadastro (doadores/CNPJs)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in set(inspector.get_table_names()):
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def _add_column_if_missing(table: str, column: sa.Column, existing: set[str]) -> None:
    if column.name not in existing:
        op.add_column(table, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_agentes_captadores" not in tabelas:
        op.create_table(
            "nfp_agentes_captadores",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("codigo", sa.String(), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False, server_default="PJ"),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("nome_fantasia", sa.String(), nullable=True),
            sa.Column("cpf", sa.String(), nullable=True),
            sa.Column("cnpj", sa.String(), nullable=True),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("telefone", sa.String(), nullable=True),
            sa.Column("cep", sa.String(), nullable=True),
            sa.Column("logradouro", sa.String(), nullable=True),
            sa.Column("numero", sa.String(), nullable=True),
            sa.Column("complemento", sa.String(), nullable=True),
            sa.Column("bairro", sa.String(), nullable=True),
            sa.Column("cidade", sa.String(), nullable=True),
            sa.Column("uf", sa.String(), nullable=True),
            sa.Column("percentual_agente", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("observacoes", sa.Text(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organizacao_id", "codigo", name="uq_nfp_agentes_org_codigo"),
        )
        op.create_index("ix_nfp_agentes_organizacao", "nfp_agentes_captadores", ["organizacao_id"])
        op.create_index(
            "ix_nfp_agentes_ativo",
            "nfp_agentes_captadores",
            ["organizacao_id", "ativo"],
        )

    cols_doadores = _colunas(inspector, "nfp_doadores")
    if cols_doadores:
        for col in (
            sa.Column("data_nascimento", sa.String(), nullable=True),
            sa.Column("cep", sa.String(), nullable=True),
            sa.Column("logradouro", sa.String(), nullable=True),
            sa.Column("numero", sa.String(), nullable=True),
            sa.Column("complemento", sa.String(), nullable=True),
            sa.Column("bairro", sa.String(), nullable=True),
            sa.Column("cidade", sa.String(), nullable=True),
            sa.Column("uf", sa.String(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("observacoes", sa.Text(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        ):
            _add_column_if_missing("nfp_doadores", col, cols_doadores)

    cols_cnpjs = _colunas(inspector, "nfp_cnpjs_lojas")
    if cols_cnpjs:
        for col in (
            sa.Column("razao_social", sa.String(), nullable=True),
            sa.Column("inscricao_estadual", sa.String(), nullable=True),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("telefone", sa.String(), nullable=True),
            sa.Column("cep", sa.String(), nullable=True),
            sa.Column("logradouro", sa.String(), nullable=True),
            sa.Column("numero", sa.String(), nullable=True),
            sa.Column("complemento", sa.String(), nullable=True),
            sa.Column("bairro", sa.String(), nullable=True),
            sa.Column("cidade", sa.String(), nullable=True),
            sa.Column("uf", sa.String(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("observacoes", sa.Text(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        ):
            _add_column_if_missing("nfp_cnpjs_lojas", col, cols_cnpjs)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_cnpjs_lojas" in tabelas:
        cols = _colunas(inspector, "nfp_cnpjs_lojas")
        for nome in (
            "razao_social",
            "inscricao_estadual",
            "email",
            "telefone",
            "cep",
            "logradouro",
            "numero",
            "complemento",
            "bairro",
            "cidade",
            "uf",
            "ativo",
            "observacoes",
            "atualizado_em",
        ):
            if nome in cols:
                op.drop_column("nfp_cnpjs_lojas", nome)

    if "nfp_doadores" in tabelas:
        cols = _colunas(inspector, "nfp_doadores")
        for nome in (
            "data_nascimento",
            "cep",
            "logradouro",
            "numero",
            "complemento",
            "bairro",
            "cidade",
            "uf",
            "ativo",
            "observacoes",
            "atualizado_em",
        ):
            if nome in cols:
                op.drop_column("nfp_doadores", nome)

    if "nfp_agentes_captadores" in tabelas:
        op.drop_index("ix_nfp_agentes_ativo", table_name="nfp_agentes_captadores")
        op.drop_index("ix_nfp_agentes_organizacao", table_name="nfp_agentes_captadores")
        op.drop_table("nfp_agentes_captadores")
