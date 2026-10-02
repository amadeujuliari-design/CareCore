"""Trabalho, parcerias e escola do convivente no lugar da observação colada.

Revision ID: q9r0s1t2u3v4
Revises: p8q9r0s1t2u3
Create Date: 2026-09-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q9r0s1t2u3v4"
down_revision: Union[str, None] = "p8q9r0s1t2u3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUNAS = (
    "ocupacao_trabalho",
    "escala_trabalho",
    "dias_trabalho",
    "trabalho_inicio",
    "trabalho_fim",
    "parcerias",
    "etapa_escolar",
    "curso_escolar",
    "turno_escolar",
    "escolar_inicio",
    "escolar_fim",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "conviventes" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("conviventes")}
    for nome in _COLUNAS:
        if nome not in existentes:
            tipo = sa.Text() if nome in {"ocupacao_trabalho", "parcerias"} else sa.String()
            op.add_column("conviventes", sa.Column(nome, tipo, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "conviventes" not in inspector.get_table_names():
        return
    existentes = {coluna["name"] for coluna in inspector.get_columns("conviventes")}
    for nome in reversed(_COLUNAS):
        if nome in existentes:
            op.drop_column("conviventes", nome)
