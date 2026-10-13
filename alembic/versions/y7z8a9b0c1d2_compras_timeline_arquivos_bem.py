"""Timeline editável e tipo de arquivo no patrimônio.

Revision ID: y7z8a9b0c1d2
Revises: x6y7z8a9b0c1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "y7z8a9b0c1d2"
down_revision: Union[str, None] = "x6y7z8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_patrimonio_anexos" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("compras_patrimonio_anexos")}
        if "tipo" not in cols:
            op.add_column("compras_patrimonio_anexos", sa.Column("tipo", sa.String(), nullable=True))
    if "compras_pedido_evento_revisoes" not in inspector.get_table_names():
        op.create_table(
            "compras_pedido_evento_revisoes",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("evento_id", sa.String(), nullable=False),
            sa.Column("texto_anterior", sa.Text(), nullable=True),
            sa.Column("usuario_id", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["evento_id"], ["compras_pedido_eventos.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_compras_pedido_evento_revisao_evento",
            "compras_pedido_evento_revisoes",
            ["evento_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedido_evento_revisoes" in inspector.get_table_names():
        op.drop_index(
            "ix_compras_pedido_evento_revisao_evento",
            table_name="compras_pedido_evento_revisoes",
        )
        op.drop_table("compras_pedido_evento_revisoes")
    if "compras_patrimonio_anexos" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("compras_patrimonio_anexos")}
        if "tipo" in cols:
            op.drop_column("compras_patrimonio_anexos", "tipo")
