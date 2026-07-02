"""Quartos TB, reserva de leito fixo e pontuação por atividade

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-07-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v7w8x9y0z1a2"
down_revision: Union[str, None] = "u6v7w8x9y0z1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect_name = bind.dialect.name if bind else ""
    colunas_conv = {c["name"] for c in inspector.get_columns("conviventes")}

    if "tb_remanejamento_situacao" not in colunas_conv:
        op.add_column(
            "conviventes",
            sa.Column("tb_remanejamento_situacao", sa.String(), nullable=True),
        )
    if "leito_reservado_id" not in colunas_conv:
        op.add_column(
            "conviventes",
            sa.Column("leito_reservado_id", sa.String(), nullable=True),
        )
        if dialect_name != "sqlite":
            op.create_foreign_key(
                "fk_conviventes_leito_reservado_id",
                "conviventes",
                "leitos",
                ["leito_reservado_id"],
                ["id"],
            )
    if "reservar_leito_fixo" not in colunas_conv:
        op.add_column(
            "conviventes",
            sa.Column(
                "reservar_leito_fixo",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    colunas_ativ = {c["name"] for c in inspector.get_columns("atividades")}
    if "contabiliza_pontos" not in colunas_ativ:
        op.add_column(
            "atividades",
            sa.Column(
                "contabiliza_pontos",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )

    colunas_pres = {c["name"] for c in inspector.get_columns("atividade_presencas")}
    if "contou_pontos" not in colunas_pres:
        op.add_column(
            "atividade_presencas",
            sa.Column(
                "contou_pontos",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect_name = bind.dialect.name if bind else ""
    colunas_conv = {c["name"] for c in inspector.get_columns("conviventes")}
    if "reservar_leito_fixo" in colunas_conv:
        op.drop_column("conviventes", "reservar_leito_fixo")
    if "leito_reservado_id" in colunas_conv:
        if dialect_name != "sqlite":
            op.drop_constraint(
                "fk_conviventes_leito_reservado_id",
                "conviventes",
                type_="foreignkey",
            )
        op.drop_column("conviventes", "leito_reservado_id")
    if "tb_remanejamento_situacao" in colunas_conv:
        op.drop_column("conviventes", "tb_remanejamento_situacao")

    colunas_ativ = {c["name"] for c in inspector.get_columns("atividades")}
    if "contabiliza_pontos" in colunas_ativ:
        op.drop_column("atividades", "contabiliza_pontos")

    colunas_pres = {c["name"] for c in inspector.get_columns("atividade_presencas")}
    if "contou_pontos" in colunas_pres:
        op.drop_column("atividade_presencas", "contou_pontos")
