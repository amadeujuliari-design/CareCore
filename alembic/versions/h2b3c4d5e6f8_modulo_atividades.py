"""migration modulo atividades

Revision ID: h2b3c4d5e6f8
Revises: g1a2b3c4d5e7
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h2b3c4d5e6f8"
down_revision: Union[str, None] = "g1a2b3c4d5e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "atividades",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("categoria", sa.String(), nullable=False, server_default="oficina"),
        sa.Column("responsavel_usuario_id", sa.String(), nullable=True),
        sa.Column("tipo_frequencia", sa.String(), nullable=False, server_default="semanal"),
        sa.Column("configuracao_agenda", sa.Text(), nullable=True),
        sa.Column("vigencia_inicio", sa.Date(), nullable=True),
        sa.Column("vigencia_fim", sa.Date(), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("criado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["responsavel_usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_atividades_instituicao_id", "atividades", ["instituicao_id"])
    op.create_index("ix_atividades_instituicao_ativo", "atividades", ["instituicao_id", "ativo"])
    op.create_index("ix_atividades_responsavel", "atividades", ["responsavel_usuario_id"])

    op.create_table(
        "atividade_ocorrencias",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("atividade_id", sa.String(), nullable=False),
        sa.Column("data_sessao", sa.Date(), nullable=False),
        sa.Column("numero_sessao_mes", sa.Integer(), nullable=False),
        sa.Column("mes_referencia", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="aberta"),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["atividade_id"], ["atividades.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("atividade_id", "data_sessao", name="uq_atividade_ocorrencia_data"),
    )
    op.create_index("ix_atividade_ocorrencias_instituicao", "atividade_ocorrencias", ["instituicao_id"])
    op.create_index(
        "ix_atividade_ocorrencias_atividade_mes",
        "atividade_ocorrencias",
        ["atividade_id", "mes_referencia"],
    )

    op.create_table(
        "atividade_presencas",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("atividade_id", sa.String(), nullable=False),
        sa.Column("ocorrencia_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("metodo_leitura", sa.String(), nullable=False),
        sa.Column("codigo_lido", sa.String(), nullable=True),
        sa.Column("registrado_em", sa.DateTime(), nullable=True),
        sa.Column("cancelado", sa.Boolean(), server_default=sa.text("0")),
        sa.Column("cancelado_por_id", sa.String(), nullable=True),
        sa.Column("cancelado_em", sa.DateTime(), nullable=True),
        sa.Column("motivo_cancelamento", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["atividade_id"], ["atividades.id"]),
        sa.ForeignKeyConstraint(["cancelado_por_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["ocorrencia_id"], ["atividade_ocorrencias.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_atividade_presencas_instituicao", "atividade_presencas", ["instituicao_id"])
    op.create_index("ix_atividade_presencas_ocorrencia", "atividade_presencas", ["ocorrencia_id"])
    op.create_index("ix_atividade_presencas_convivente", "atividade_presencas", ["convivente_id"])
    op.create_index("ix_atividade_presencas_atividade", "atividade_presencas", ["atividade_id"])

    op.create_table(
        "atividade_sessao_conteudos",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("atividade_id", sa.String(), nullable=False),
        sa.Column("ocorrencia_id", sa.String(), nullable=False),
        sa.Column("acoes_realizadas", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["atividade_id"], ["atividades.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["ocorrencia_id"], ["atividade_ocorrencias.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ocorrencia_id", name="uq_atividade_sessao_conteudo_ocorrencia"),
    )
    op.create_index(
        "ix_atividade_sessao_conteudos_ocorrencia",
        "atividade_sessao_conteudos",
        ["ocorrencia_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_atividade_sessao_conteudos_ocorrencia", table_name="atividade_sessao_conteudos")
    op.drop_table("atividade_sessao_conteudos")
    op.drop_index("ix_atividade_presencas_atividade", table_name="atividade_presencas")
    op.drop_index("ix_atividade_presencas_convivente", table_name="atividade_presencas")
    op.drop_index("ix_atividade_presencas_ocorrencia", table_name="atividade_presencas")
    op.drop_index("ix_atividade_presencas_instituicao", table_name="atividade_presencas")
    op.drop_table("atividade_presencas")
    op.drop_index("ix_atividade_ocorrencias_atividade_mes", table_name="atividade_ocorrencias")
    op.drop_index("ix_atividade_ocorrencias_instituicao", table_name="atividade_ocorrencias")
    op.drop_table("atividade_ocorrencias")
    op.drop_index("ix_atividades_responsavel", table_name="atividades")
    op.drop_index("ix_atividades_instituicao_ativo", table_name="atividades")
    op.drop_index("ix_atividades_instituicao_id", table_name="atividades")
    op.drop_table("atividades")
