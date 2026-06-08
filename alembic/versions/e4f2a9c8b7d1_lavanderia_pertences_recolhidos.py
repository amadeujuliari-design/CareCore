"""lavanderia e pertences recolhidos

Revision ID: e4f2a9c8b7d1
Revises: d2a8f6c1b9e0
Create Date: 2026-06-08 13:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f2a9c8b7d1"
down_revision: Union[str, Sequence[str], None] = "d2a8f6c1b9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_tabela(inspector, tabela: str) -> bool:
    return tabela in inspector.get_table_names()


def _tem_indice(inspector, tabela: str, indice: str) -> bool:
    if not _tem_tabela(inspector, tabela):
        return False
    return indice in {item["name"] for item in inspector.get_indexes(tabela)}


def _criar_indice_se_nao_existir(nome: str, tabela: str, colunas: list[str]) -> None:
    inspector = sa.inspect(op.get_bind())
    if not _tem_indice(inspector, tabela, nome):
        op.create_index(nome, tabela, colunas, unique=False)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not _tem_tabela(inspector, "lavanderia_registros"):
        op.create_table(
            "lavanderia_registros",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("convivente_id", sa.String(), nullable=False),
            sa.Column("usuario_entrega_id", sa.String(), nullable=False),
            sa.Column("quantidade_entregue", sa.Integer(), nullable=False),
            sa.Column("entregue_em", sa.DateTime(), nullable=True),
            sa.Column("prazo_retirada_em", sa.DateTime(), nullable=False),
            sa.Column("observacao_entrega", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("quantidade_retirada", sa.Integer(), nullable=True),
            sa.Column("usuario_retirada_id", sa.String(), nullable=True),
            sa.Column("retirado_em", sa.DateTime(), nullable=True),
            sa.Column("observacao_retirada", sa.Text(), nullable=True),
            sa.Column("cancelado_por_id", sa.String(), nullable=True),
            sa.Column("cancelado_em", sa.DateTime(), nullable=True),
            sa.Column("motivo_cancelamento", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["cancelado_por_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["usuario_entrega_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["usuario_retirada_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _criar_indice_se_nao_existir("ix_lavanderia_registros_convivente_id", "lavanderia_registros", ["convivente_id"])
    _criar_indice_se_nao_existir("ix_lavanderia_registros_entregue_em", "lavanderia_registros", ["entregue_em"])
    _criar_indice_se_nao_existir("ix_lavanderia_registros_instituicao_id", "lavanderia_registros", ["instituicao_id"])
    _criar_indice_se_nao_existir("ix_lavanderia_registros_prazo_retirada_em", "lavanderia_registros", ["prazo_retirada_em"])
    _criar_indice_se_nao_existir("ix_lavanderia_registros_status", "lavanderia_registros", ["status"])

    inspector = sa.inspect(op.get_bind())
    if not _tem_tabela(inspector, "pertences_recolhidos"):
        op.create_table(
            "pertences_recolhidos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("quarto_id", sa.String(), nullable=False),
            sa.Column("usuario_recolha_id", sa.String(), nullable=False),
            sa.Column("quantidade_recolhida", sa.Integer(), nullable=False),
            sa.Column("quantidade_disponivel", sa.Integer(), nullable=False),
            sa.Column("recolhido_em", sa.DateTime(), nullable=True),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("encerrado_por_id", sa.String(), nullable=True),
            sa.Column("encerrado_em", sa.DateTime(), nullable=True),
            sa.Column("justificativa_encerramento", sa.Text(), nullable=True),
            sa.Column("destino_encerramento", sa.String(), nullable=True),
            sa.ForeignKeyConstraint(["encerrado_por_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["quarto_id"], ["quartos.id"]),
            sa.ForeignKeyConstraint(["usuario_recolha_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _criar_indice_se_nao_existir("ix_pertences_recolhidos_instituicao_id", "pertences_recolhidos", ["instituicao_id"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_quarto_id", "pertences_recolhidos", ["quarto_id"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_recolhido_em", "pertences_recolhidos", ["recolhido_em"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_status", "pertences_recolhidos", ["status"])

    inspector = sa.inspect(op.get_bind())
    if not _tem_tabela(inspector, "pertences_recolhidos_baixas"):
        op.create_table(
            "pertences_recolhidos_baixas",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("pertence_recolhido_id", sa.String(), nullable=False),
            sa.Column("convivente_id", sa.String(), nullable=True),
            sa.Column("usuario_id", sa.String(), nullable=False),
            sa.Column("quantidade", sa.Integer(), nullable=False),
            sa.Column("tipo_baixa", sa.String(), nullable=False),
            sa.Column("justificativa", sa.Text(), nullable=True),
            sa.Column("destino", sa.String(), nullable=True),
            sa.Column("baixado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["pertence_recolhido_id"], ["pertences_recolhidos.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _criar_indice_se_nao_existir("ix_pertences_recolhidos_baixas_convivente_id", "pertences_recolhidos_baixas", ["convivente_id"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_baixas_instituicao_id", "pertences_recolhidos_baixas", ["instituicao_id"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_baixas_pertence_recolhido_id", "pertences_recolhidos_baixas", ["pertence_recolhido_id"])
    _criar_indice_se_nao_existir("ix_pertences_recolhidos_baixas_baixado_em", "pertences_recolhidos_baixas", ["baixado_em"])


def downgrade() -> None:
    op.drop_index("ix_pertences_recolhidos_baixas_baixado_em", table_name="pertences_recolhidos_baixas")
    op.drop_index("ix_pertences_recolhidos_baixas_pertence_recolhido_id", table_name="pertences_recolhidos_baixas")
    op.drop_index("ix_pertences_recolhidos_baixas_instituicao_id", table_name="pertences_recolhidos_baixas")
    op.drop_index("ix_pertences_recolhidos_baixas_convivente_id", table_name="pertences_recolhidos_baixas")
    op.drop_table("pertences_recolhidos_baixas")
    op.drop_index("ix_pertences_recolhidos_status", table_name="pertences_recolhidos")
    op.drop_index("ix_pertences_recolhidos_recolhido_em", table_name="pertences_recolhidos")
    op.drop_index("ix_pertences_recolhidos_quarto_id", table_name="pertences_recolhidos")
    op.drop_index("ix_pertences_recolhidos_instituicao_id", table_name="pertences_recolhidos")
    op.drop_table("pertences_recolhidos")
    op.drop_index("ix_lavanderia_registros_status", table_name="lavanderia_registros")
    op.drop_index("ix_lavanderia_registros_prazo_retirada_em", table_name="lavanderia_registros")
    op.drop_index("ix_lavanderia_registros_instituicao_id", table_name="lavanderia_registros")
    op.drop_index("ix_lavanderia_registros_entregue_em", table_name="lavanderia_registros")
    op.drop_index("ix_lavanderia_registros_convivente_id", table_name="lavanderia_registros")
    op.drop_table("lavanderia_registros")
