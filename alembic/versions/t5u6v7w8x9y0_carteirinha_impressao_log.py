"""Log de impressões oficiais de carteirinha

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-06-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "t5u6v7w8x9y0"
down_revision: Union[str, None] = "s4t5u6v7w8x9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "carteirinha_impressao_logs" in inspector.get_table_names():
        return

    op.create_table(
        "carteirinha_impressao_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("origem", sa.String(), nullable=False, server_default="unitaria"),
        sa.Column("impresso_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_carteirinha_impressao_logs_instituicao_id",
        "carteirinha_impressao_logs",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_carteirinha_impressao_logs_convivente_id",
        "carteirinha_impressao_logs",
        ["convivente_id"],
    )
    op.create_index(
        "ix_carteirinha_impressao_logs_usuario_id",
        "carteirinha_impressao_logs",
        ["usuario_id"],
    )
    op.create_index(
        "ix_carteirinha_impressao_logs_origem",
        "carteirinha_impressao_logs",
        ["origem"],
    )
    op.create_index(
        "ix_carteirinha_impressao_logs_impresso_em",
        "carteirinha_impressao_logs",
        ["impresso_em"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "carteirinha_impressao_logs" not in inspector.get_table_names():
        return
    op.drop_table("carteirinha_impressao_logs")
