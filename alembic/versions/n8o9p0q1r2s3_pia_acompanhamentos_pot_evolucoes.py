"""PIA origem acompanhamentos + evoluções POT

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-06-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n8o9p0q1r2s3"
down_revision: Union[str, None] = "m7n8o9p0q1r2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "registros_pia",
        sa.Column("origem_modulo", sa.String(), nullable=True),
    )
    op.add_column(
        "registros_pia",
        sa.Column("origem_registro_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_registros_pia_origem",
        "registros_pia",
        ["origem_modulo", "origem_registro_id"],
    )

    op.add_column(
        "acompanhamentos_pot",
        sa.Column("registro_pai_id", sa.String(), nullable=True),
    )
    op.add_column(
        "acompanhamentos_pot",
        sa.Column("status_evolucao", sa.String(), nullable=True),
    )
    op.add_column(
        "acompanhamentos_pot",
        sa.Column("data_evolucao", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_acomp_pot_registro_pai_id",
        "acompanhamentos_pot",
        ["registro_pai_id"],
    )
    op.create_index(
        "ix_acomp_pot_status_evolucao",
        "acompanhamentos_pot",
        ["status_evolucao"],
    )

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_acomp_pot_registro_pai",
            "acompanhamentos_pot",
            "acompanhamentos_pot",
            ["registro_pai_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_acomp_pot_registro_pai", "acompanhamentos_pot", type_="foreignkey")
    op.drop_index("ix_acomp_pot_status_evolucao", table_name="acompanhamentos_pot")
    op.drop_index("ix_acomp_pot_registro_pai_id", table_name="acompanhamentos_pot")
    op.drop_column("acompanhamentos_pot", "data_evolucao")
    op.drop_column("acompanhamentos_pot", "status_evolucao")
    op.drop_column("acompanhamentos_pot", "registro_pai_id")
    op.drop_index("ix_registros_pia_origem", table_name="registros_pia")
    op.drop_column("registros_pia", "origem_registro_id")
    op.drop_column("registros_pia", "origem_modulo")
