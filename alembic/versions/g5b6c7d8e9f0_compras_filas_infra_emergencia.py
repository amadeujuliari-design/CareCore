"""Filas da Infraestrutura: OK final e NF enviada a pagamento.

Revision ID: g5b6c7d8e9f0
Revises: f4a5b6c7d8e9
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g5b6c7d8e9f0"
down_revision: Union[str, None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedidos" not in tabelas:
        return
    cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    if "infraestrutura_ok_final_em" not in cols:
        op.add_column("compras_pedidos", sa.Column("infraestrutura_ok_final_em", sa.DateTime(), nullable=True))
    if "infraestrutura_ok_final_por_id" not in cols:
        op.add_column("compras_pedidos", sa.Column("infraestrutura_ok_final_por_id", sa.String(), nullable=True))
    if "nf_para_pagamento_em" not in cols:
        op.add_column("compras_pedidos", sa.Column("nf_para_pagamento_em", sa.DateTime(), nullable=True))
    if "nf_para_pagamento_por_id" not in cols:
        op.add_column("compras_pedidos", sa.Column("nf_para_pagamento_por_id", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "compras_pedidos" not in tabelas:
        return
    cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    for nome in (
        "nf_para_pagamento_por_id",
        "nf_para_pagamento_em",
        "infraestrutura_ok_final_por_id",
        "infraestrutura_ok_final_em",
    ):
        if nome in cols:
            op.drop_column("compras_pedidos", nome)
