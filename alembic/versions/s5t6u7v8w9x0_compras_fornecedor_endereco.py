"""Endereço estruturado em compras_fornecedores.

Revision ID: s5t6u7v8w9x0
Revises: r4s5t6u7v8w9
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "s5t6u7v8w9x0"
down_revision: Union[str, None] = "r4s5t6u7v8w9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedores" not in inspector.get_table_names():
        return
    cols = _colunas(inspector, "compras_fornecedores")
    for nome, tipo in (
        ("cep", sa.String()),
        ("logradouro", sa.String()),
        ("numero", sa.String()),
        ("complemento", sa.String()),
        ("bairro", sa.String()),
        ("uf", sa.String()),
    ):
        if nome not in cols:
            op.add_column("compras_fornecedores", sa.Column(nome, tipo, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedores" not in inspector.get_table_names():
        return
    cols = _colunas(inspector, "compras_fornecedores")
    for nome in ("uf", "bairro", "complemento", "numero", "logradouro", "cep"):
        if nome in cols:
            op.drop_column("compras_fornecedores", nome)
