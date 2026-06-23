"""Endereço estruturado em familiares do convivente.

Revision ID: f9b2c3d4e5f6
Revises: e8f1a2b3c4d5
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa


revision = "f9b2c3d4e5f6"
down_revision = "e8f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for nome, tipo in (
        ("cep", sa.String()),
        ("logradouro", sa.String()),
        ("numero", sa.String()),
        ("complemento", sa.String()),
        ("bairro", sa.String()),
        ("cidade", sa.String()),
        ("uf", sa.String()),
    ):
        op.add_column("convivente_familiares", sa.Column(nome, tipo, nullable=True))


def downgrade() -> None:
    for nome in ("uf", "cidade", "bairro", "complemento", "numero", "logradouro", "cep"):
        op.drop_column("convivente_familiares", nome)
