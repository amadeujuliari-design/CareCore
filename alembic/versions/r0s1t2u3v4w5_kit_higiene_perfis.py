"""Faixa de idade e sexo nos perfis do kit de higiene.

Revision ID: r0s1t2u3v4w5
Revises: q9r0s1t2u3v4
Create Date: 2026-10-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "r0s1t2u3v4w5"
down_revision: Union[str, None] = "q9r0s1t2u3v4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUNAS = {
    "idade_min": sa.Integer(),
    "idade_max": sa.Integer(),
    "sexo": sa.String(),
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tipos_individuo_higiene" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("tipos_individuo_higiene")}
    for nome, tipo in _COLUNAS.items():
        if nome not in existentes:
            op.add_column("tipos_individuo_higiene", sa.Column(nome, tipo, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tipos_individuo_higiene" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("tipos_individuo_higiene")}
    for nome in reversed(tuple(_COLUNAS)):
        if nome in existentes:
            op.drop_column("tipos_individuo_higiene", nome)
