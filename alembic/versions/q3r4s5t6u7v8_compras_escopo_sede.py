"""Compras: pedidos da Sede (organizacao) sem instituicao ficticia.

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "q3r4s5t6u7v8"
down_revision: Union[str, None] = "p2q3r4s5t6u7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "compras_pedidos" in tabelas:
        cols = _colunas(inspector, "compras_pedidos")
        if "escopo_unidade" not in cols:
            op.add_column(
                "compras_pedidos",
                sa.Column(
                    "escopo_unidade",
                    sa.String(),
                    nullable=False,
                    server_default="projeto",
                ),
            )
        with op.batch_alter_table("compras_pedidos") as batch:
            batch.alter_column("instituicao_id", existing_type=sa.String(), nullable=True)

    if "compras_patrimonio" in tabelas:
        with op.batch_alter_table("compras_patrimonio") as batch:
            batch.alter_column("instituicao_id", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "compras_patrimonio" in tabelas:
        with op.batch_alter_table("compras_patrimonio") as batch:
            batch.alter_column("instituicao_id", existing_type=sa.String(), nullable=False)

    if "compras_pedidos" in tabelas:
        cols = _colunas(inspector, "compras_pedidos")
        with op.batch_alter_table("compras_pedidos") as batch:
            batch.alter_column("instituicao_id", existing_type=sa.String(), nullable=False)
        if "escopo_unidade" in cols:
            op.drop_column("compras_pedidos", "escopo_unidade")
