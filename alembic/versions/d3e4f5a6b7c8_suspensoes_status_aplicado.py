"""suspensoes status_aplicado not null e indice

Revision ID: d3e4f5a6b7c8
Revises: c1d2e3f4a5b6
Create Date: 2026-06-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE acompanhamentos_suspensoes_provisorias "
            "SET status_aplicado = 'Bloqueado' "
            "WHERE status_aplicado IS NULL"
        )
    )
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.alter_column(
            "acompanhamentos_suspensoes_provisorias",
            "status_aplicado",
            existing_type=sa.String(),
            nullable=False,
            server_default="Bloqueado",
        )
    else:
        with op.batch_alter_table("acompanhamentos_suspensoes_provisorias") as batch_op:
            batch_op.alter_column(
                "status_aplicado",
                existing_type=sa.String(),
                nullable=False,
                server_default="Bloqueado",
            )

    op.create_index(
        "ix_acomp_suspensoes_status_aplicado",
        "acompanhamentos_suspensoes_provisorias",
        ["status_aplicado"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_acomp_suspensoes_status_aplicado",
        table_name="acompanhamentos_suspensoes_provisorias",
    )
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.alter_column(
            "acompanhamentos_suspensoes_provisorias",
            "status_aplicado",
            existing_type=sa.String(),
            nullable=True,
            server_default=None,
        )
    else:
        with op.batch_alter_table("acompanhamentos_suspensoes_provisorias") as batch_op:
            batch_op.alter_column(
                "status_aplicado",
                existing_type=sa.String(),
                nullable=True,
                server_default=None,
            )
