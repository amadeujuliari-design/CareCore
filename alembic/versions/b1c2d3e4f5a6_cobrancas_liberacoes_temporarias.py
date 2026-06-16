"""cobrancas liberacoes temporarias

Revision ID: b1c2d3e4f5a6
Revises: a9c8e7d6f5b4
Create Date: 2026-06-15 21:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a9c8e7d6f5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "cobranca_liberacoes_temporarias" in inspector.get_table_names():
        return

    op.create_table(
        "cobranca_liberacoes_temporarias",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organizacao_id", sa.String(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("liberado_ate", sa.DateTime(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_por_id", sa.String(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("revogado_por_id", sa.String(), nullable=True),
        sa.Column("revogado_em", sa.DateTime(), nullable=True),
        sa.Column("observacao_revogacao", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
        sa.ForeignKeyConstraint(["revogado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cobranca_liberacoes_temporarias_organizacao_id", "cobranca_liberacoes_temporarias", ["organizacao_id"])
    op.create_index("ix_cobranca_liberacoes_organizacao_ativo", "cobranca_liberacoes_temporarias", ["organizacao_id", "ativo"])
    op.create_index("ix_cobranca_liberacoes_organizacao_prazo", "cobranca_liberacoes_temporarias", ["organizacao_id", "liberado_ate"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "cobranca_liberacoes_temporarias" not in inspector.get_table_names():
        return

    op.drop_table("cobranca_liberacoes_temporarias")
