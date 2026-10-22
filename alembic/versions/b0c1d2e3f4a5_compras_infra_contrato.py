"""Pedido de Infraestrutura: informações, destino e etapas do contrato.

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedidos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
        for nome, tipo in (
            ("info_pedido", sa.Text()),
            ("fornecedor_pedido_nome", sa.String()),
            ("fornecedor_pedido_info", sa.Text()),
            ("destino_compras", sa.String()),
        ):
            if nome not in cols:
                op.add_column("compras_pedidos", sa.Column(nome, tipo, nullable=True))
    if "compras_pedido_anexos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_anexos")}
        for nome in ("classe_documento", "etapa_contrato"):
            if nome not in cols:
                op.add_column("compras_pedido_anexos", sa.Column(nome, sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedido_anexos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedido_anexos")}
        for nome in ("etapa_contrato", "classe_documento"):
            if nome in cols:
                op.drop_column("compras_pedido_anexos", nome)
    if "compras_pedidos" in tabelas:
        cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
        for nome in (
            "destino_compras",
            "fornecedor_pedido_info",
            "fornecedor_pedido_nome",
            "info_pedido",
        ):
            if nome in cols:
                op.drop_column("compras_pedidos", nome)
