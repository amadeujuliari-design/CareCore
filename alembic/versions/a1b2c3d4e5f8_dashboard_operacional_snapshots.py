"""Snapshots diarios do dashboard operacional (22h SP)

Revision ID: a1b2c3d4e5f8
Revises: z1a2b3c4d5e6
Create Date: 2026-07-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f8"
down_revision: Union[str, None] = "z1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "dashboard_operacional_snapshots" in tabelas:
        return

    op.create_table(
        "dashboard_operacional_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("data_referencia", sa.Date(), nullable=False),
        sa.Column("capturado_em", sa.DateTime(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "instituicao_id",
            "data_referencia",
            name="uq_dashboard_operacional_snapshot_dia",
        ),
    )
    op.create_index(
        "ix_dash_op_snap_instituicao",
        "dashboard_operacional_snapshots",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_dash_op_snap_data",
        "dashboard_operacional_snapshots",
        ["instituicao_id", "data_referencia"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "dashboard_operacional_snapshots" not in set(inspector.get_table_names()):
        return
    op.drop_index("ix_dash_op_snap_data", table_name="dashboard_operacional_snapshots")
    op.drop_index("ix_dash_op_snap_instituicao", table_name="dashboard_operacional_snapshots")
    op.drop_table("dashboard_operacional_snapshots")
