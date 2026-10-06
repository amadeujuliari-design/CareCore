"""Torna obrigatórias as colunas novas do kit do Cruzeiro.

Revision ID: u3v4w5x6y7z8
Revises: t2u3v4w5x6y7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "u3v4w5x6y7z8"
down_revision: Union[str, None] = "t2u3v4w5x6y7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "conviventes" in tabelas:
        op.execute(sa.text("UPDATE conviventes SET kit_menstrua = 0 WHERE kit_menstrua IS NULL"))
        with op.batch_alter_table("conviventes") as lote:
            lote.alter_column("kit_menstrua", existing_type=sa.Boolean(), nullable=False)
    if "tipos_individuo_higiene" in tabelas:
        op.execute(sa.text("UPDATE tipos_individuo_higiene SET papel = 'base' WHERE papel IS NULL"))
        op.execute(sa.text("UPDATE tipos_individuo_higiene SET gatilho = 'idade' WHERE gatilho IS NULL"))
        with op.batch_alter_table("tipos_individuo_higiene") as lote:
            lote.alter_column("papel", existing_type=sa.String(), nullable=False)
            lote.alter_column("gatilho", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    pass
