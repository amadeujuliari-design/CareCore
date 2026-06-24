"""assinatura digital formulário PIA — persistência online

Revision ID: f0a1b2c3d4e6
Revises: a1b2c3d4e5f7
Create Date: 2026-06-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e6"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assinaturas_formulario_pia",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("tipo_evento", sa.String(), nullable=False),
        sa.Column("metodo_leitura", sa.String(), nullable=True),
        sa.Column("codigo_lido", sa.String(), nullable=False),
        sa.Column("numero_prontuario", sa.Integer(), nullable=True),
        sa.Column("modo_formulario", sa.String(), nullable=True),
        sa.Column("assinado_em", sa.DateTime(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assinaturas_formulario_pia_convivente",
        "assinaturas_formulario_pia",
        ["convivente_id", "assinado_em"],
    )
    op.create_index(
        "ix_assinaturas_formulario_pia_instituicao",
        "assinaturas_formulario_pia",
        ["instituicao_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assinaturas_formulario_pia_instituicao", table_name="assinaturas_formulario_pia")
    op.drop_index("ix_assinaturas_formulario_pia_convivente", table_name="assinaturas_formulario_pia")
    op.drop_table("assinaturas_formulario_pia")
