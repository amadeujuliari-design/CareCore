"""Compras: segmento do catálogo nas categorias (consumo/manutenção/…).

Revision ID: h0b1c2d3e4f5
Revises: g9a0b1c2d3e4
Create Date: 2026-08-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "h0b1c2d3e4f5"
down_revision: Union[str, None] = "g9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_categorias" not in inspector.get_table_names():
        return
    cols = _cols(inspector, "compras_categorias")
    if "segmento" not in cols:
        op.add_column(
            "compras_categorias",
            sa.Column("segmento", sa.String(), nullable=False, server_default="consumo"),
        )

    # Backfill por nome da categoria (heurística conservadora).
    bind.execute(
        sa.text(
            """
            UPDATE compras_categorias
            SET segmento = 'manutencao'
            WHERE lower(nome) LIKE '%manuten%'
               OR lower(nome) LIKE '%infraestrutura%'
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE compras_categorias
            SET segmento = 'imobilizado'
            WHERE lower(nome) LIKE '%imobil%'
               OR lower(nome) LIKE '%patrimon%'
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "segmento" in _cols(inspector, "compras_categorias"):
        op.drop_column("compras_categorias", "segmento")
