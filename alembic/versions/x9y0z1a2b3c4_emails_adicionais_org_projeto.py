"""E-mails adicionais em organizacao e projeto

Revision ID: x9y0z1a2b3c4
Revises: w8x9y0z1a2b3
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "x9y0z1a2b3c4"
down_revision: Union[str, None] = "w8x9y0z1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    colunas_org = {c["name"] for c in inspector.get_columns("organizacoes")}
    if "emails_adicionais" not in colunas_org:
        op.add_column("organizacoes", sa.Column("emails_adicionais", sa.Text(), nullable=True))

    colunas_inst = {c["name"] for c in inspector.get_columns("instituicoes")}
    if "emails_adicionais" not in colunas_inst:
        op.add_column("instituicoes", sa.Column("emails_adicionais", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    colunas_inst = {c["name"] for c in inspector.get_columns("instituicoes")}
    if "emails_adicionais" in colunas_inst:
        op.drop_column("instituicoes", "emails_adicionais")

    colunas_org = {c["name"] for c in inspector.get_columns("organizacoes")}
    if "emails_adicionais" in colunas_org:
        op.drop_column("organizacoes", "emails_adicionais")
