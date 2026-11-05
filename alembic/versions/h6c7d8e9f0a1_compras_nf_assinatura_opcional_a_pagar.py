"""compras: NF assinatura opcional, data pagamento, leitura A pagar

Revision ID: h6c7d8e9f0a1
Revises: g5b6c7d8e9f0
Create Date: 2026-11-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "h6c7d8e9f0a1"
down_revision = "g5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols_nf = {c["name"] for c in insp.get_columns("compras_pedido_notas_fiscais")}
    if "data_pagamento" not in cols_nf:
        op.add_column(
            "compras_pedido_notas_fiscais",
            sa.Column("data_pagamento", sa.Date(), nullable=True),
        )
    if "assinada_em" not in cols_nf:
        op.add_column(
            "compras_pedido_notas_fiscais",
            sa.Column("assinada_em", sa.DateTime(), nullable=True),
        )
    if "assinada_por_id" not in cols_nf:
        op.add_column(
            "compras_pedido_notas_fiscais",
            sa.Column("assinada_por_id", sa.String(), nullable=True),
        )

    cols_p = {c["name"] for c in insp.get_columns("compras_pedidos")}
    if "a_pagar_lida_em" not in cols_p:
        op.add_column(
            "compras_pedidos",
            sa.Column("a_pagar_lida_em", sa.DateTime(), nullable=True),
        )
    if "a_pagar_lida_por_id" not in cols_p:
        op.add_column(
            "compras_pedidos",
            sa.Column("a_pagar_lida_por_id", sa.String(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("compras_pedidos", "a_pagar_lida_por_id")
    op.drop_column("compras_pedidos", "a_pagar_lida_em")
    op.drop_column("compras_pedido_notas_fiscais", "assinada_por_id")
    op.drop_column("compras_pedido_notas_fiscais", "assinada_em")
    op.drop_column("compras_pedido_notas_fiscais", "data_pagamento")
