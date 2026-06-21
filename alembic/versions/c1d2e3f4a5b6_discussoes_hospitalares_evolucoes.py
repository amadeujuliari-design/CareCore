"""discussoes hospitalares evolucoes

Revision ID: c1d2e3f4a5b6
Revises: b0c8d3e4f5a6
Create Date: 2026-06-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b0c8d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "acompanhamentos_discussoes_hospitalares",
        sa.Column("registro_pai_id", sa.String(), nullable=True),
    )
    op.add_column(
        "acompanhamentos_discussoes_hospitalares",
        sa.Column("status_evolucao", sa.String(), nullable=True),
    )
    op.add_column(
        "acompanhamentos_discussoes_hospitalares",
        sa.Column("data_evolucao", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_acomp_discussoes_registro_pai_id",
        "acompanhamentos_discussoes_hospitalares",
        ["registro_pai_id"],
    )
    op.create_index(
        "ix_acomp_discussoes_status_evolucao",
        "acompanhamentos_discussoes_hospitalares",
        ["status_evolucao"],
    )

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_acomp_discussoes_registro_pai",
            "acompanhamentos_discussoes_hospitalares",
            "acompanhamentos_discussoes_hospitalares",
            ["registro_pai_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_acomp_discussoes_registro_pai", "acompanhamentos_discussoes_hospitalares", type_="foreignkey")
    op.drop_index("ix_acomp_discussoes_status_evolucao", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_index("ix_acomp_discussoes_registro_pai_id", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_column("acompanhamentos_discussoes_hospitalares", "data_evolucao")
    op.drop_column("acompanhamentos_discussoes_hospitalares", "status_evolucao")
    op.drop_column("acompanhamentos_discussoes_hospitalares", "registro_pai_id")
