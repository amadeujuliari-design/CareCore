"""Pagamento a vista ou parcelado nos pedidos de Infraestrutura.

Revision ID: f4a5b6c7d8e9
Revises: c9d0e1f2a3b4
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedidos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
        if "pagamento_qtd_parcelas" not in cols:
            op.add_column("compras_pedidos", sa.Column("pagamento_qtd_parcelas", sa.Integer(), nullable=True))
        if "pagamento_quitado_em" not in cols:
            op.add_column("compras_pedidos", sa.Column("pagamento_quitado_em", sa.DateTime(), nullable=True))
    if "compras_pedido_anexos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_anexos")}
        if "parcela_numero" not in cols:
            op.add_column("compras_pedido_anexos", sa.Column("parcela_numero", sa.Integer(), nullable=True))
    if "compras_pedido_notas_fiscais" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_notas_fiscais")}
        if "parcela_numero" not in cols:
            op.add_column("compras_pedido_notas_fiscais", sa.Column("parcela_numero", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedido_notas_fiscais" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_notas_fiscais")}
        if "parcela_numero" in cols:
            op.drop_column("compras_pedido_notas_fiscais", "parcela_numero")
    if "compras_pedido_anexos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_anexos")}
        if "parcela_numero" in cols:
            op.drop_column("compras_pedido_anexos", "parcela_numero")
    if "compras_pedidos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
        if "pagamento_quitado_em" in cols:
            op.drop_column("compras_pedidos", "pagamento_quitado_em")
        if "pagamento_qtd_parcelas" in cols:
            op.drop_column("compras_pedidos", "pagamento_qtd_parcelas")
