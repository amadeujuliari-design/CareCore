"""Complementos do kit e flag de menstruação do Cruzeiro do Sul.

Revision ID: t2u3v4w5x6y7
Revises: s1t2u3v4w5x6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "t2u3v4w5x6y7"
down_revision: Union[str, None] = "s1t2u3v4w5x6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _adicionar(tabela: str, nome: str, tipo, **kwargs) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if tabela not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns(tabela)}
    if nome not in existentes:
        op.add_column(tabela, sa.Column(nome, tipo, **kwargs))


def upgrade() -> None:
    _adicionar("tipos_individuo_higiene", "papel", sa.String(), nullable=True)
    _adicionar("tipos_individuo_higiene", "gatilho", sa.String(), nullable=True)
    _adicionar("tipos_individuo_higiene", "idade_min_meses", sa.Integer(), nullable=True)
    _adicionar("tipos_individuo_higiene", "idade_max_meses", sa.Integer(), nullable=True)
    _adicionar("conviventes", "kit_menstrua", sa.Boolean(), nullable=True)


def downgrade() -> None:
    pass
