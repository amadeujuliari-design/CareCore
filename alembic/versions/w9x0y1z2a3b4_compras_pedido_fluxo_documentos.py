"""Fluxo documental de pedidos: eventos, anexos, NFs e reprovação.

Revision ID: w9x0y1z2a3b4
Revises: v8w9x0y1z2a3
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "w9x0y1z2a3b4"
down_revision: Union[str, None] = "v8w9x0y1z2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cols = _colunas(inspector, "compras_pedidos")
    if cols:
        if "status_anterior" not in cols:
            op.add_column("compras_pedidos", sa.Column("status_anterior", sa.String(), nullable=True))
        if "reprovado_em" not in cols:
            op.add_column("compras_pedidos", sa.Column("reprovado_em", sa.DateTime(), nullable=True))
        if "reprovado_por_id" not in cols:
            op.add_column(
                "compras_pedidos",
                sa.Column("reprovado_por_id", sa.String(), nullable=True),
            )
        if "motivo_reprovacao" not in cols:
            op.add_column("compras_pedidos", sa.Column("motivo_reprovacao", sa.Text(), nullable=True))
        if "pedido_compra_anexo_id" not in cols:
            op.add_column("compras_pedidos", sa.Column("pedido_compra_anexo_id", sa.String(), nullable=True))

    cols_cot = _colunas(inspector, "compras_cotacoes")
    if cols_cot:
        if "ativa" not in cols_cot:
            op.add_column("compras_cotacoes", sa.Column("ativa", sa.Boolean(), nullable=False, server_default=sa.true()))
        if "substituida_por_id" not in cols_cot:
            op.add_column("compras_cotacoes", sa.Column("substituida_por_id", sa.String(), nullable=True))

    if "compras_pedido_anexos" not in inspector.get_table_names():
        op.create_table(
            "compras_pedido_anexos",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=False),
            sa.Column("cotacao_id", sa.String(), sa.ForeignKey("compras_cotacoes.id"), nullable=True),
            sa.Column("nota_fiscal_id", sa.String(), nullable=True),
            sa.Column("tipo", sa.String(), nullable=False),
            sa.Column("nome_arquivo", sa.String(), nullable=False),
            sa.Column("caminho_arquivo", sa.String(), nullable=False),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("tamanho_bytes", sa.Integer(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("substituido_por_id", sa.String(), nullable=True),
            sa.Column("criado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_pedido_anexo_pedido", "compras_pedido_anexos", ["pedido_id"])

    if "compras_pedido_notas_fiscais" not in inspector.get_table_names():
        op.create_table(
            "compras_pedido_notas_fiscais",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=False),
            sa.Column("anexo_id", sa.String(), sa.ForeignKey("compras_pedido_anexos.id"), nullable=True),
            sa.Column("tipo_nf", sa.String(), nullable=False, server_default="produto"),
            sa.Column("numero", sa.String(), nullable=True),
            sa.Column("serie", sa.String(), nullable=True),
            sa.Column("chave_acesso", sa.String(), nullable=True),
            sa.Column("emitente_nome", sa.String(), nullable=True),
            sa.Column("emitente_cnpj", sa.String(), nullable=True),
            sa.Column("data_emissao", sa.Date(), nullable=True),
            sa.Column("valor_centavos", sa.Integer(), nullable=True),
            sa.Column("origem_dados", sa.String(), nullable=False, server_default="manual"),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("criado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_pedido_nf_pedido", "compras_pedido_notas_fiscais", ["pedido_id"])

    if "compras_pedido_eventos" not in inspector.get_table_names():
        op.create_table(
            "compras_pedido_eventos",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False),
            sa.Column("texto", sa.Text(), nullable=True),
            sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("cotacao_id", sa.String(), sa.ForeignKey("compras_cotacoes.id"), nullable=True),
            sa.Column("anexo_id", sa.String(), sa.ForeignKey("compras_pedido_anexos.id"), nullable=True),
            sa.Column("status_anterior", sa.String(), nullable=True),
            sa.Column("status_novo", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_pedido_evento_pedido", "compras_pedido_eventos", ["pedido_id"])


def downgrade() -> None:
    op.drop_index("ix_compras_pedido_evento_pedido", table_name="compras_pedido_eventos")
    op.drop_table("compras_pedido_eventos")
    op.drop_index("ix_compras_pedido_nf_pedido", table_name="compras_pedido_notas_fiscais")
    op.drop_table("compras_pedido_notas_fiscais")
    op.drop_index("ix_compras_pedido_anexo_pedido", table_name="compras_pedido_anexos")
    op.drop_table("compras_pedido_anexos")
    for col in ("pedido_compra_anexo_id", "motivo_reprovacao", "reprovado_por_id", "reprovado_em", "status_anterior"):
        with op.batch_alter_table("compras_pedidos") as batch:
            batch.drop_column(col)
    for col in ("substituida_por_id", "ativa"):
        with op.batch_alter_table("compras_cotacoes") as batch:
            batch.drop_column(col)
