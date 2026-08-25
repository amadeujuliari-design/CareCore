"""Compras: split por categoria, confirmação de eventos e vínculo de origem.

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-08-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "compras_pedidos" in inspector.get_table_names():
        cols = _cols(inspector, "compras_pedidos")
        if "pedido_origem_id" not in cols:
            op.add_column("compras_pedidos", sa.Column("pedido_origem_id", sa.String(), nullable=True))
        if "grupo_split_id" not in cols:
            op.add_column("compras_pedidos", sa.Column("grupo_split_id", sa.String(), nullable=True))
        if "categoria_split_id" not in cols:
            op.add_column("compras_pedidos", sa.Column("categoria_split_id", sa.String(), nullable=True))
        if "categoria_split_nome" not in cols:
            op.add_column("compras_pedidos", sa.Column("categoria_split_nome", sa.String(), nullable=True))
        inspector = sa.inspect(bind)
        idxs = {i["name"] for i in inspector.get_indexes("compras_pedidos")}
        if "ix_compras_pedidos_pedido_origem_id" not in idxs:
            op.create_index(
                "ix_compras_pedidos_pedido_origem_id",
                "compras_pedidos",
                ["pedido_origem_id"],
            )
        # Nome padrão do index=True em models.ComprasPedidoDB.grupo_split_id
        if "ix_compras_pedidos_grupo_split_id" not in idxs:
            op.create_index(
                "ix_compras_pedidos_grupo_split_id",
                "compras_pedidos",
                ["grupo_split_id"],
            )
        # Legado local: índice com nome antigo — remove se existir (idempotente).
        if "ix_compras_pedido_grupo_split" in idxs:
            op.drop_index("ix_compras_pedido_grupo_split", table_name="compras_pedidos")

    if "compras_pedido_eventos" in inspector.get_table_names():
        cols = _cols(inspector, "compras_pedido_eventos")
        if "aguardando_confirmacao" not in cols:
            op.add_column(
                "compras_pedido_eventos",
                sa.Column(
                    "aguardando_confirmacao",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                ),
            )
        if "confirmado_em" not in cols:
            op.add_column("compras_pedido_eventos", sa.Column("confirmado_em", sa.DateTime(), nullable=True))
        if "confirmado_por_id" not in cols:
            op.add_column("compras_pedido_eventos", sa.Column("confirmado_por_id", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "compras_pedido_eventos" in inspector.get_table_names():
        cols = _cols(inspector, "compras_pedido_eventos")
        for col in ("confirmado_por_id", "confirmado_em", "aguardando_confirmacao"):
            if col in cols:
                op.drop_column("compras_pedido_eventos", col)

    if "compras_pedidos" in inspector.get_table_names():
        idxs = {i["name"] for i in inspector.get_indexes("compras_pedidos")}
        for nome_idx in ("ix_compras_pedido_grupo_split", "ix_compras_pedidos_grupo_split_id", "ix_compras_pedidos_pedido_origem_id"):
            if nome_idx in idxs:
                op.drop_index(nome_idx, table_name="compras_pedidos")
        cols = _cols(inspector, "compras_pedidos")
        for col in ("categoria_split_nome", "categoria_split_id", "grupo_split_id", "pedido_origem_id"):
            if col in cols:
                op.drop_column("compras_pedidos", col)
