"""Migration: pacote da organizacao + modulo financeiro pessoal."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j2k3l4m5n6o7"
down_revision: Union[str, None] = "i1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "organizacoes" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("organizacoes")}
        if "tipo_pacote" not in cols:
            op.add_column(
                "organizacoes",
                sa.Column(
                    "tipo_pacote",
                    sa.String(),
                    nullable=False,
                    server_default="assistencial",
                ),
            )

    if "usuario_organizacao_acesso" not in tabelas:
        op.create_table(
            "usuario_organizacao_acesso",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("usuario_id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "usuario_id",
                "organizacao_id",
                name="uq_usuario_organizacao_acesso",
            ),
        )
        op.create_index(
            "ix_usuario_organizacao_acesso_usuario_id",
            "usuario_organizacao_acesso",
            ["usuario_id"],
        )
        op.create_index(
            "ix_usuario_organizacao_acesso_organizacao_id",
            "usuario_organizacao_acesso",
            ["organizacao_id"],
        )

    if "financeiro_contas" not in tabelas:
        op.create_table(
            "financeiro_contas",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False, server_default="corrente"),
            sa.Column("saldo", sa.Float(), nullable=False, server_default="0"),
            sa.Column("rende", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_financeiro_contas_org", "financeiro_contas", ["organizacao_id"])

    if "financeiro_transacoes" not in tabelas:
        op.create_table(
            "financeiro_transacoes",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("conta_id", sa.String(), nullable=True),
            sa.Column("descricao", sa.String(), nullable=False),
            sa.Column("valor", sa.Float(), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False),
            sa.Column("categoria", sa.String(), nullable=True),
            sa.Column("data", sa.Date(), nullable=False),
            sa.Column("pago", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("origem_arquivo", sa.String(), nullable=True),
            sa.Column("parcela_atual", sa.Integer(), nullable=True),
            sa.Column("parcelas_total", sa.Integer(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["conta_id"], ["financeiro_contas.id"]),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_financeiro_transacoes_org_data",
            "financeiro_transacoes",
            ["organizacao_id", "data"],
        )

    if "financeiro_regras_categoria" not in tabelas:
        op.create_table(
            "financeiro_regras_categoria",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("palavra_chave", sa.String(), nullable=False),
            sa.Column("categoria", sa.String(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_financeiro_regras_org",
            "financeiro_regras_categoria",
            ["organizacao_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    for tabela in (
        "financeiro_regras_categoria",
        "financeiro_transacoes",
        "financeiro_contas",
        "usuario_organizacao_acesso",
    ):
        if tabela in tabelas:
            op.drop_table(tabela)

    if "organizacoes" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("organizacoes")}
        if "tipo_pacote" in cols:
            op.drop_column("organizacoes", "tipo_pacote")
