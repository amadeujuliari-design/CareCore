"""Cadastro de itens de consumo do módulo Compras.

Revision ID: x0y1z2a3b4c5
Revises: w9x0y1z2a3b4
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "x0y1z2a3b4c5"
down_revision: Union[str, None] = "w9x0y1z2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "compras_itens_consumo" not in tabelas:
        op.create_table(
            "compras_itens_consumo",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("categoria_id", sa.String(), sa.ForeignKey("compras_categorias.id"), nullable=True),
            sa.Column("descricao", sa.String(), nullable=False),
            sa.Column("chave", sa.String(), nullable=False),
            sa.Column("unidade_medida", sa.String(), nullable=True),
            sa.Column("marca_preferencial", sa.String(), nullable=True),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organizacao_id", "chave", name="uq_compras_item_consumo_org_chave"),
        )
        op.create_index("ix_compras_item_consumo_org", "compras_itens_consumo", ["organizacao_id"])
        op.create_index("ix_compras_item_consumo_org_ativo", "compras_itens_consumo", ["organizacao_id", "ativo"])

    if "compras_pedido_itens" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_itens")}
        if "catalogo_item_id" not in cols:
            op.add_column(
                "compras_pedido_itens",
                sa.Column("catalogo_item_id", sa.String(), nullable=True),
            )


def downgrade() -> None:
    with op.batch_alter_table("compras_pedido_itens") as batch:
        batch.drop_column("catalogo_item_id")
    op.drop_constraint("uq_compras_item_consumo_org_chave", "compras_itens_consumo", type_="unique")
    op.drop_index("ix_compras_item_consumo_org_ativo", table_name="compras_itens_consumo")
    op.drop_index("ix_compras_item_consumo_org", table_name="compras_itens_consumo")
    op.drop_table("compras_itens_consumo")
