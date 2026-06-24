"""assinatura termo bagageiro — persistência online

Revision ID: g1a2b3c4d5e7
Revises: f0a1b2c3d4e6
Create Date: 2026-06-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g1a2b3c4d5e7"
down_revision: Union[str, None] = "f0a1b2c3d4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assinaturas_termo_bagageiro",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("tipo_evento", sa.String(), nullable=False),
        sa.Column("metodo_leitura", sa.String(), nullable=True),
        sa.Column("codigo_lido", sa.String(), nullable=True),
        sa.Column("numero_prontuario", sa.Integer(), nullable=True),
        sa.Column("assinado_em", sa.DateTime(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assinaturas_termo_bagageiro_convivente",
        "assinaturas_termo_bagageiro",
        ["convivente_id", "criado_em"],
    )
    op.create_index(
        "ix_assinaturas_termo_bagageiro_instituicao",
        "assinaturas_termo_bagageiro",
        ["instituicao_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assinaturas_termo_bagageiro_instituicao", table_name="assinaturas_termo_bagageiro")
    op.drop_index("ix_assinaturas_termo_bagageiro_convivente", table_name="assinaturas_termo_bagageiro")
    op.drop_table("assinaturas_termo_bagageiro")
