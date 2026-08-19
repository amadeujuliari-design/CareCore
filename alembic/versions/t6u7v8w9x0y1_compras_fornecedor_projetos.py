"""Vínculo fornecedor ↔ projetos (instituições).

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "t6u7v8w9x0y1"
down_revision: Union[str, None] = "s5t6u7v8w9x0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedores" in inspector.get_table_names():
        cols = _colunas(inspector, "compras_fornecedores")
        if "atende_geral" not in cols:
            op.add_column(
                "compras_fornecedores",
                sa.Column("atende_geral", sa.Boolean(), nullable=False, server_default=sa.true()),
            )

    if "compras_fornecedor_projetos" not in inspector.get_table_names():
        op.create_table(
            "compras_fornecedor_projetos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("fornecedor_id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["fornecedor_id"], ["compras_fornecedores.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("fornecedor_id", "instituicao_id", name="uq_compras_fornecedor_projeto"),
        )
        op.create_index(
            "ix_compras_fornecedor_proj_forn",
            "compras_fornecedor_projetos",
            ["fornecedor_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedor_projetos" in inspector.get_table_names():
        op.drop_index("ix_compras_fornecedor_proj_forn", table_name="compras_fornecedor_projetos")
        op.drop_table("compras_fornecedor_projetos")
    if "compras_fornecedores" in inspector.get_table_names():
        cols = _colunas(inspector, "compras_fornecedores")
        if "atende_geral" in cols:
            op.drop_column("compras_fornecedores", "atende_geral")
