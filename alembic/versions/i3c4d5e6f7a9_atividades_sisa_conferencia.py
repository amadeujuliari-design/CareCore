"""SISA conferência atividades — campos SISA, catálogo e horário por sessão

Revision ID: i3c4d5e6f7a9
Revises: h2b3c4d5e6f8
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i3c4d5e6f7a9"
down_revision: Union[str, None] = "h2b3c4d5e6f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas_atividades = {col["name"] for col in inspector.get_columns("atividades")}
    if "sisa_descricao_atividade" not in colunas_atividades:
        op.add_column("atividades", sa.Column("sisa_descricao_atividade", sa.String(), nullable=True))
    if "sisa_descricao_tema" not in colunas_atividades:
        op.add_column("atividades", sa.Column("sisa_descricao_tema", sa.String(), nullable=True))
    if "sisa_horario_padrao" not in colunas_atividades:
        op.add_column("atividades", sa.Column("sisa_horario_padrao", sa.String(), nullable=True))

    colunas_ocorrencias = {col["name"] for col in inspector.get_columns("atividade_ocorrencias")}
    if "horario_sessao" not in colunas_ocorrencias:
        op.add_column(
            "atividade_ocorrencias",
            sa.Column("horario_sessao", sa.String(), nullable=False, server_default=""),
        )

    constraints_ocorrencias = {
        item["name"]
        for item in inspector.get_unique_constraints("atividade_ocorrencias")
    }
    if "uq_atividade_ocorrencia_data_horario" not in constraints_ocorrencias:
        with op.batch_alter_table("atividade_ocorrencias") as batch_op:
            if "uq_atividade_ocorrencia_data" in constraints_ocorrencias:
                batch_op.drop_constraint("uq_atividade_ocorrencia_data", type_="unique")
            batch_op.create_unique_constraint(
                "uq_atividade_ocorrencia_data_horario",
                ["atividade_id", "data_sessao", "horario_sessao"],
            )

    if "atividade_catalogo_sisa" not in inspector.get_table_names():
        op.create_table(
            "atividade_catalogo_sisa",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False),
            sa.Column("valor", sa.String(), nullable=False),
            sa.Column("valor_norm", sa.String(), nullable=False),
            sa.Column("personalizado", sa.Boolean(), server_default=sa.text("1")),
            sa.Column("criado_por_id", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("instituicao_id", "tipo", "valor_norm", name="uq_atividade_catalogo_sisa_valor"),
        )
        op.create_index("ix_atividade_catalogo_sisa_instituicao", "atividade_catalogo_sisa", ["instituicao_id"])

    if "atividade_sisa_vinculos" not in inspector.get_table_names():
        op.create_table(
            "atividade_sisa_vinculos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("sisa_descricao_atividade", sa.String(), nullable=False),
            sa.Column("sisa_descricao_tema", sa.String(), nullable=False),
            sa.Column("sisa_horario", sa.String(), nullable=False, server_default=""),
            sa.Column("sisa_descricao_atividade_norm", sa.String(), nullable=False),
            sa.Column("sisa_descricao_tema_norm", sa.String(), nullable=False),
            sa.Column("sisa_horario_norm", sa.String(), nullable=False, server_default=""),
            sa.Column("atividade_id", sa.String(), nullable=False),
            sa.Column("criado_por_id", sa.String(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["atividade_id"], ["atividades.id"]),
            sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "instituicao_id",
                "sisa_descricao_atividade_norm",
                "sisa_descricao_tema_norm",
                "sisa_horario_norm",
                name="uq_atividade_sisa_vinculo_chave",
            ),
        )
        op.create_index("ix_atividade_sisa_vinculos_instituicao", "atividade_sisa_vinculos", ["instituicao_id"])


def downgrade() -> None:
    op.drop_index("ix_atividade_sisa_vinculos_instituicao", table_name="atividade_sisa_vinculos")
    op.drop_table("atividade_sisa_vinculos")
    op.drop_index("ix_atividade_catalogo_sisa_instituicao", table_name="atividade_catalogo_sisa")
    op.drop_table("atividade_catalogo_sisa")

    with op.batch_alter_table("atividade_ocorrencias") as batch_op:
        batch_op.drop_constraint("uq_atividade_ocorrencia_data_horario", type_="unique")
        batch_op.create_unique_constraint("uq_atividade_ocorrencia_data", ["atividade_id", "data_sessao"])
    op.drop_column("atividade_ocorrencias", "horario_sessao")

    op.drop_column("atividades", "sisa_horario_padrao")
    op.drop_column("atividades", "sisa_descricao_tema")
    op.drop_column("atividades", "sisa_descricao_atividade")
