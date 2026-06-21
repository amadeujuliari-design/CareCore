"""acompanhamentos tecnico

Revision ID: a9c4e1f2b7d3
Revises: f3b7c2d8a1e4
Create Date: 2026-06-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9c4e1f2b7d3"
down_revision: Union[str, None] = "f3b7c2d8a1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "acompanhamentos_transferencias",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("destino", sa.String(), nullable=False),
        sa.Column("destino_outro", sa.String(), nullable=True),
        sa.Column("data_discussao", sa.Date(), nullable=True),
        sa.Column("data_visita", sa.Date(), nullable=True),
        sa.Column("data_transferencia", sa.Date(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_acomp_transferencias_instituicao_id",
        "acompanhamentos_transferencias",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_acomp_transferencias_convivente_id",
        "acompanhamentos_transferencias",
        ["convivente_id"],
    )
    op.create_index(
        "ix_acomp_transferencias_destino",
        "acompanhamentos_transferencias",
        ["destino"],
    )
    op.create_index(
        "ix_acomp_transferencias_data_transferencia",
        "acompanhamentos_transferencias",
        ["data_transferencia"],
    )
    op.create_index(
        "ix_acomp_transferencias_criado_em",
        "acompanhamentos_transferencias",
        ["criado_em"],
    )

    op.create_table(
        "acompanhamentos_discussoes_hospitalares",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("nome_hospital", sa.String(), nullable=True),
        sa.Column("data_discussao", sa.Date(), nullable=True),
        sa.Column("data_prevista_entrada", sa.Date(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_acomp_discussoes_instituicao_id",
        "acompanhamentos_discussoes_hospitalares",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_acomp_discussoes_convivente_id",
        "acompanhamentos_discussoes_hospitalares",
        ["convivente_id"],
    )
    op.create_index(
        "ix_acomp_discussoes_data_discussao",
        "acompanhamentos_discussoes_hospitalares",
        ["data_discussao"],
    )
    op.create_index(
        "ix_acomp_discussoes_criado_em",
        "acompanhamentos_discussoes_hospitalares",
        ["criado_em"],
    )

    op.create_table(
        "acompanhamentos_tb",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("situacao", sa.String(), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_acomp_tb_instituicao_id", "acompanhamentos_tb", ["instituicao_id"])
    op.create_index("ix_acomp_tb_convivente_id", "acompanhamentos_tb", ["convivente_id"])
    op.create_index("ix_acomp_tb_situacao", "acompanhamentos_tb", ["situacao"])
    op.create_index("ix_acomp_tb_data_inicio", "acompanhamentos_tb", ["data_inicio"])
    op.create_index("ix_acomp_tb_criado_em", "acompanhamentos_tb", ["criado_em"])

    op.create_table(
        "acompanhamentos_pot",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("data_insercao", sa.Date(), nullable=True),
        sa.Column("data_desligamento", sa.Date(), nullable=True),
        sa.Column("congelamento_ativo", sa.Boolean(), nullable=True),
        sa.Column("congelamento_inicio", sa.Date(), nullable=True),
        sa.Column("congelamento_fim", sa.Date(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_acomp_pot_instituicao_id", "acompanhamentos_pot", ["instituicao_id"])
    op.create_index("ix_acomp_pot_convivente_id", "acompanhamentos_pot", ["convivente_id"])
    op.create_index("ix_acomp_pot_data_insercao", "acompanhamentos_pot", ["data_insercao"])
    op.create_index("ix_acomp_pot_criado_em", "acompanhamentos_pot", ["criado_em"])

    op.create_table(
        "acompanhamentos_suspensoes_provisorias",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("convivente_id", sa.String(), nullable=False),
        sa.Column("mes_referencia", sa.String(), nullable=False),
        sa.Column("data_registro", sa.Date(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.String(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_acomp_suspensoes_instituicao_id",
        "acompanhamentos_suspensoes_provisorias",
        ["instituicao_id"],
    )
    op.create_index(
        "ix_acomp_suspensoes_convivente_id",
        "acompanhamentos_suspensoes_provisorias",
        ["convivente_id"],
    )
    op.create_index(
        "ix_acomp_suspensoes_mes_referencia",
        "acompanhamentos_suspensoes_provisorias",
        ["mes_referencia"],
    )
    op.create_index(
        "ix_acomp_suspensoes_data_registro",
        "acompanhamentos_suspensoes_provisorias",
        ["data_registro"],
    )
    op.create_index(
        "ix_acomp_suspensoes_criado_em",
        "acompanhamentos_suspensoes_provisorias",
        ["criado_em"],
    )


def downgrade() -> None:
    op.drop_index("ix_acomp_suspensoes_criado_em", table_name="acompanhamentos_suspensoes_provisorias")
    op.drop_index("ix_acomp_suspensoes_data_registro", table_name="acompanhamentos_suspensoes_provisorias")
    op.drop_index("ix_acomp_suspensoes_mes_referencia", table_name="acompanhamentos_suspensoes_provisorias")
    op.drop_index("ix_acomp_suspensoes_convivente_id", table_name="acompanhamentos_suspensoes_provisorias")
    op.drop_index("ix_acomp_suspensoes_instituicao_id", table_name="acompanhamentos_suspensoes_provisorias")
    op.drop_table("acompanhamentos_suspensoes_provisorias")

    op.drop_index("ix_acomp_pot_criado_em", table_name="acompanhamentos_pot")
    op.drop_index("ix_acomp_pot_data_insercao", table_name="acompanhamentos_pot")
    op.drop_index("ix_acomp_pot_convivente_id", table_name="acompanhamentos_pot")
    op.drop_index("ix_acomp_pot_instituicao_id", table_name="acompanhamentos_pot")
    op.drop_table("acompanhamentos_pot")

    op.drop_index("ix_acomp_tb_criado_em", table_name="acompanhamentos_tb")
    op.drop_index("ix_acomp_tb_data_inicio", table_name="acompanhamentos_tb")
    op.drop_index("ix_acomp_tb_situacao", table_name="acompanhamentos_tb")
    op.drop_index("ix_acomp_tb_convivente_id", table_name="acompanhamentos_tb")
    op.drop_index("ix_acomp_tb_instituicao_id", table_name="acompanhamentos_tb")
    op.drop_table("acompanhamentos_tb")

    op.drop_index("ix_acomp_discussoes_criado_em", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_index("ix_acomp_discussoes_data_discussao", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_index("ix_acomp_discussoes_convivente_id", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_index("ix_acomp_discussoes_instituicao_id", table_name="acompanhamentos_discussoes_hospitalares")
    op.drop_table("acompanhamentos_discussoes_hospitalares")

    op.drop_index("ix_acomp_transferencias_criado_em", table_name="acompanhamentos_transferencias")
    op.drop_index("ix_acomp_transferencias_data_transferencia", table_name="acompanhamentos_transferencias")
    op.drop_index("ix_acomp_transferencias_destino", table_name="acompanhamentos_transferencias")
    op.drop_index("ix_acomp_transferencias_convivente_id", table_name="acompanhamentos_transferencias")
    op.drop_index("ix_acomp_transferencias_instituicao_id", table_name="acompanhamentos_transferencias")
    op.drop_table("acompanhamentos_transferencias")
