"""Rascunho de consumo com data prevista e envio automatico.

Revision ID: v8w9x0y1z2a3
Revises: u7v8w9x0y1z2
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "v8w9x0y1z2a3"
down_revision: Union[str, None] = "u7v8w9x0y1z2"
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
    if not cols:
        return
    if "data_envio_prevista" not in cols:
        op.add_column("compras_pedidos", sa.Column("data_envio_prevista", sa.Date(), nullable=True))
    if "envio_automatico" not in cols:
        op.add_column(
            "compras_pedidos",
            sa.Column("envio_automatico", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _colunas(inspector, "compras_pedidos")
    if "envio_automatico" in cols:
        op.drop_column("compras_pedidos", "envio_automatico")
    if "data_envio_prevista" in cols:
        op.drop_column("compras_pedidos", "data_envio_prevista")
