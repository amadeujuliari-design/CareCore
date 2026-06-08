"""ausencia justificada

Revision ID: b8f1a7c2d4e9
Revises: a6d4f2b91c30
Create Date: 2026-06-06 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8f1a7c2d4e9"
down_revision: Union[str, Sequence[str], None] = "a6d4f2b91c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(inspector, tabela: str, coluna: str) -> bool:
    return coluna in {item["name"] for item in inspector.get_columns(tabela)}


def _tem_indice(inspector, tabela: str, indice: str) -> bool:
    return indice in {item["name"] for item in inspector.get_indexes(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect_name = bind.dialect.name if bind else ""

    if not _tem_coluna(inspector, "conviventes", "ausencia_justificada_desde"):
        op.add_column(
            "conviventes",
            sa.Column("ausencia_justificada_desde", sa.Date(), nullable=True),
        )

    inspector = sa.inspect(bind)
    if not _tem_indice(inspector, "conviventes", "ix_conviventes_ausencia_justificada_desde"):
        op.create_index(
            "ix_conviventes_ausencia_justificada_desde",
            "conviventes",
            ["ausencia_justificada_desde"],
        )

    inspector = sa.inspect(bind)
    if not inspector.has_table("ausencias_justificadas_confirmacoes"):
        op.create_table(
            "ausencias_justificadas_confirmacoes",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("convivente_id", sa.String(), nullable=False),
            sa.Column("usuario_id", sa.String(), nullable=False),
            sa.Column("data_referencia", sa.Date(), nullable=False),
            sa.Column("continua_ausente", sa.Boolean(), nullable=False),
            sa.Column("status_atribuido", sa.String(), nullable=True),
            sa.Column("justificativa", sa.Text(), nullable=True),
            sa.Column("respondido_em", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if dialect_name != "sqlite" and not inspector.has_table("ausencias_justificadas_confirmacoes"):
        op.create_foreign_key(
            "fk_aus_just_conf_instituicao",
            "ausencias_justificadas_confirmacoes",
            "instituicoes",
            ["instituicao_id"],
            ["id"],
        )
        op.create_foreign_key(
            "fk_aus_just_conf_convivente",
            "ausencias_justificadas_confirmacoes",
            "conviventes",
            ["convivente_id"],
            ["id"],
        )
        op.create_foreign_key(
            "fk_aus_just_conf_usuario",
            "ausencias_justificadas_confirmacoes",
            "usuarios",
            ["usuario_id"],
            ["id"],
        )

    inspector = sa.inspect(bind)
    indices = {
        "ix_aus_just_conf_instituicao_id": ["instituicao_id"],
        "ix_aus_just_conf_convivente_id": ["convivente_id"],
        "ix_aus_just_conf_data_referencia": ["data_referencia"],
    }
    for nome_indice, colunas in indices.items():
        if not _tem_indice(inspector, "ausencias_justificadas_confirmacoes", nome_indice):
            op.create_index(nome_indice, "ausencias_justificadas_confirmacoes", colunas)

    if not _tem_indice(inspector, "ausencias_justificadas_confirmacoes", "ux_aus_just_conf_convivente_data"):
        op.create_index(
            "ux_aus_just_conf_convivente_data",
            "ausencias_justificadas_confirmacoes",
            ["instituicao_id", "convivente_id", "data_referencia"],
            unique=True,
        )

    inspector = sa.inspect(bind)
    for indice_auto_create_all in (
        "ix_ausencias_justificadas_confirmacoes_convivente_id",
        "ix_ausencias_justificadas_confirmacoes_data_referencia",
        "ix_ausencias_justificadas_confirmacoes_instituicao_id",
    ):
        if _tem_indice(inspector, "ausencias_justificadas_confirmacoes", indice_auto_create_all):
            op.drop_index(indice_auto_create_all, table_name="ausencias_justificadas_confirmacoes")


def downgrade() -> None:
    op.drop_index("ux_aus_just_conf_convivente_data", table_name="ausencias_justificadas_confirmacoes")
    op.drop_index("ix_aus_just_conf_data_referencia", table_name="ausencias_justificadas_confirmacoes")
    op.drop_index("ix_aus_just_conf_convivente_id", table_name="ausencias_justificadas_confirmacoes")
    op.drop_index("ix_aus_just_conf_instituicao_id", table_name="ausencias_justificadas_confirmacoes")
    op.drop_table("ausencias_justificadas_confirmacoes")
    op.drop_index("ix_conviventes_ausencia_justificada_desde", table_name="conviventes")
    op.drop_column("conviventes", "ausencia_justificada_desde")
