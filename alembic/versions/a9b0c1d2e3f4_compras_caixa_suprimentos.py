"""Caixa de Suprimentos: leitura do pedido concluído e impressão da NF.

Revision ID: a9b0c1d2e3f4
Revises: z8a9b0c1d2e3
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "z8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedidos" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    novas = (
        ("suprimentos_lida_em", sa.DateTime(), True),
        ("suprimentos_lida_por_id", sa.String(), True),
        ("nf_impressa_em", sa.DateTime(), True),
        ("nf_impressa_por_id", sa.String(), True),
    )
    for nome, tipo, nulo in novas:
        if nome not in cols:
            op.add_column("compras_pedidos", sa.Column(nome, tipo, nullable=nulo))
    # Pedidos já encerrados antes desta caixa não entram como não lidos.
    op.execute(
        sa.text(
            """
            UPDATE compras_pedidos
               SET suprimentos_lida_em = COALESCE(recebido_em, atualizado_em, criado_em)
             WHERE suprimentos_lida_em IS NULL
               AND status IN ('recebido', 'cancelado', 'reprovado')
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedidos" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    for nome in (
        "nf_impressa_por_id",
        "nf_impressa_em",
        "suprimentos_lida_por_id",
        "suprimentos_lida_em",
    ):
        if nome in cols:
            op.drop_column("compras_pedidos", nome)
