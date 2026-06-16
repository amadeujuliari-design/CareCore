"""cobrancas ciclos asaas

Revision ID: a9c8e7d6f5b4
Revises: a9d8e7c6b5a4
Create Date: 2026-06-15 19:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9c8e7d6f5b4"
down_revision: Union[str, Sequence[str], None] = "a9d8e7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "cobranca_ciclos" not in tabelas:
        op.create_table(
            "cobranca_ciclos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("data_fechamento", sa.Date(), nullable=False),
            sa.Column("data_corte_inativacao", sa.Date(), nullable=False),
            sa.Column("data_vencimento", sa.Date(), nullable=False),
            sa.Column("modo", sa.String(), nullable=False),
            sa.Column("total_cadastros_faturaveis", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("valor_total_mensalidade", sa.Float(), nullable=False, server_default="0"),
            sa.Column("status", sa.String(), nullable=False, server_default="Calculado"),
            sa.Column("status_pagamento", sa.String(), nullable=False, server_default="Pendente"),
            sa.Column("asaas_customer_id", sa.String(), nullable=True),
            sa.Column("asaas_payment_id", sa.String(), nullable=True),
            sa.Column("asaas_invoice_url", sa.String(), nullable=True),
            sa.Column("asaas_bank_slip_url", sa.String(), nullable=True),
            sa.Column("asaas_pix_qr_code", sa.Text(), nullable=True),
            sa.Column("criado_por_id", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.Column("pago_em", sa.DateTime(), nullable=True),
            sa.Column("cancelado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organizacao_id", "data_fechamento", name="uq_cobranca_ciclo_organizacao_fechamento"),
        )
        op.create_index("ix_cobranca_ciclos_organizacao_id", "cobranca_ciclos", ["organizacao_id"])
        op.create_index("ix_cobranca_ciclos_asaas_payment_id", "cobranca_ciclos", ["asaas_payment_id"])
        op.create_index("ix_cobranca_ciclos_organizacao_fechamento", "cobranca_ciclos", ["organizacao_id", "data_fechamento"])
        op.create_index("ix_cobranca_ciclos_organizacao_status", "cobranca_ciclos", ["organizacao_id", "status_pagamento"])

    if "cobranca_projetos_rateio" not in tabelas:
        op.create_table(
            "cobranca_projetos_rateio",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("ciclo_id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("projeto_nome", sa.String(), nullable=False),
            sa.Column("conviventes_faturaveis", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("usuarios_faturaveis", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("cadastros_faturaveis", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("percentual_rateio", sa.Float(), nullable=True),
            sa.Column("valor_mensalidade", sa.Float(), nullable=False, server_default="0"),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["ciclo_id"], ["cobranca_ciclos.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("ciclo_id", "instituicao_id", name="uq_cobranca_rateio_ciclo_projeto"),
        )
        op.create_index("ix_cobranca_projetos_rateio_ciclo_id", "cobranca_projetos_rateio", ["ciclo_id"])
        op.create_index("ix_cobranca_projetos_rateio_organizacao_id", "cobranca_projetos_rateio", ["organizacao_id"])
        op.create_index("ix_cobranca_projetos_rateio_instituicao_id", "cobranca_projetos_rateio", ["instituicao_id"])

    if "cobranca_eventos_asaas" not in tabelas:
        op.create_table(
            "cobranca_eventos_asaas",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("ciclo_id", sa.String(), nullable=True),
            sa.Column("organizacao_id", sa.String(), nullable=True),
            sa.Column("asaas_event_id", sa.String(), nullable=True),
            sa.Column("evento_tipo", sa.String(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.Column("recebido_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["ciclo_id"], ["cobranca_ciclos.id"]),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("asaas_event_id"),
        )
        op.create_index("ix_cobranca_eventos_asaas_ciclo_id", "cobranca_eventos_asaas", ["ciclo_id"])
        op.create_index("ix_cobranca_eventos_asaas_organizacao_id", "cobranca_eventos_asaas", ["organizacao_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "cobranca_eventos_asaas" in tabelas:
        op.drop_table("cobranca_eventos_asaas")
    if "cobranca_projetos_rateio" in tabelas:
        op.drop_table("cobranca_projetos_rateio")
    if "cobranca_ciclos" in tabelas:
        op.drop_table("cobranca_ciclos")
