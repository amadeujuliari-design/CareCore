"""Migration: campos Finance.Pro + investimentos."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k3l4m5n6o7p8"
down_revision: Union[str, None] = "j2k3l4m5n6o7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "financeiro_transacoes" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("financeiro_transacoes")}
        novas = {
            "cartao_id": sa.Column("cartao_id", sa.String(), nullable=True),
            "projetado": sa.Column("projetado", sa.Boolean(), nullable=False, server_default=sa.false()),
            "mes_fatura": sa.Column("mes_fatura", sa.String(), nullable=True),
            "pagamento_vinculado_id": sa.Column("pagamento_vinculado_id", sa.String(), nullable=True),
            "ciclo_whatsapp": sa.Column("ciclo_whatsapp", sa.String(), nullable=True),
            "responsavel": sa.Column("responsavel", sa.String(), nullable=True),
            "url_nota": sa.Column("url_nota", sa.String(), nullable=True),
        }
        for nome, coluna in novas.items():
            if nome not in cols:
                op.add_column("financeiro_transacoes", coluna)

    if "financeiro_investimentos" not in tabelas:
        op.create_table(
            "financeiro_investimentos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("tipo", sa.String(), nullable=True),
            sa.Column("valor", sa.Float(), nullable=False, server_default="0"),
            sa.Column("taxa", sa.Float(), nullable=False, server_default="0"),
            sa.Column("data_inicio", sa.Date(), nullable=True),
            sa.Column("data_liquidez", sa.Date(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="active"),
            sa.Column("moeda", sa.String(), nullable=False, server_default="BRL"),
            sa.Column("ir", sa.Float(), nullable=True),
            sa.Column("cdi", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("cdi_percentual", sa.Float(), nullable=True),
            sa.Column("liquidez", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_financeiro_investimentos_org",
            "financeiro_investimentos",
            ["organizacao_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "financeiro_investimentos" in tabelas:
        op.drop_table("financeiro_investimentos")

    if "financeiro_transacoes" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("financeiro_transacoes")}
        for nome in (
            "url_nota",
            "responsavel",
            "ciclo_whatsapp",
            "pagamento_vinculado_id",
            "mes_fatura",
            "projetado",
            "cartao_id",
        ):
            if nome in cols:
                op.drop_column("financeiro_transacoes", nome)
