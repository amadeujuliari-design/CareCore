"""Compras: campos enriquecidos de fornecedores (planilha Sede AEB).

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "r4s5t6u7v8w9"
down_revision: Union[str, None] = "q3r4s5t6u7v8"
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
    if "segmento" not in cols:
        op.add_column("compras_fornecedores", sa.Column("segmento", sa.String(), nullable=True))
    if "email_empresa" not in cols:
        op.add_column("compras_fornecedores", sa.Column("email_empresa", sa.String(), nullable=True))
    if "projetos_atendidos" not in cols:
        op.add_column("compras_fornecedores", sa.Column("projetos_atendidos", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedores" not in inspector.get_table_names():
        return
    cols = _colunas(inspector, "compras_fornecedores")
    if "projetos_atendidos" in cols:
        op.drop_column("compras_fornecedores", "projetos_atendidos")
    if "email_empresa" in cols:
        op.drop_column("compras_fornecedores", "email_empresa")
    if "segmento" in cols:
        op.drop_column("compras_fornecedores", "segmento")
