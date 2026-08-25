"""Compras: tipos manutenção/serviço e cabeçalho da cotação do projeto.

Revision ID: f8a9b0c1d2e3
Revises: d6e7f8a9b0c1
Create Date: 2026-08-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLS = (
    ("titulo", sa.String()),
    ("justificativa", sa.Text()),
    ("urgencia", sa.String()),
    ("data_desejada", sa.Date()),
    ("local_texto", sa.String()),
    ("patrimonio_id", sa.String()),
    ("defeito", sa.Text()),
    ("tipo_manutencao", sa.String()),
    ("escopo_servico", sa.Text()),
    ("valor_estimado_centavos", sa.Integer()),
)


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedidos" not in inspector.get_table_names():
        return
    existentes = _cols(inspector, "compras_pedidos")
    for nome, col_type in _COLS:
        if nome not in existentes:
            op.add_column("compras_pedidos", sa.Column(nome, col_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedidos" not in inspector.get_table_names():
        return
    existentes = _cols(inspector, "compras_pedidos")
    for nome, _ in reversed(_COLS):
        if nome in existentes:
            op.drop_column("compras_pedidos", nome)
