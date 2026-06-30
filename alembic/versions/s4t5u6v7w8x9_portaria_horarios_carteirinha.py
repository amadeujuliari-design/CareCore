"""Portaria horários exceção e contador carteirinha

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-06-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "s4t5u6v7w8x9"
down_revision: Union[str, None] = "r3s4t5u6v7w8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas_conv = {c["name"] for c in inspector.get_columns("conviventes")}
    colunas_rotina = {c["name"] for c in inspector.get_columns("registros_rotina")}

    if "portaria_excecao_motivo" not in colunas_conv:
        op.add_column("conviventes", sa.Column("portaria_excecao_motivo", sa.String(), nullable=True))
    if "portaria_excecao_saida_ate" not in colunas_conv:
        op.add_column("conviventes", sa.Column("portaria_excecao_saida_ate", sa.String(), nullable=True))
    if "portaria_excecao_entrada_ate" not in colunas_conv:
        op.add_column("conviventes", sa.Column("portaria_excecao_entrada_ate", sa.String(), nullable=True))
    if "impressoes_carteirinha_oficiais" not in colunas_conv:
        op.add_column(
            "conviventes",
            sa.Column("impressoes_carteirinha_oficiais", sa.Integer(), nullable=False, server_default="0"),
        )

    if "justificativa_horario_portaria" not in colunas_rotina:
        op.add_column("registros_rotina", sa.Column("justificativa_horario_portaria", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    colunas_conv = {c["name"] for c in inspector.get_columns("conviventes")}
    colunas_rotina = {c["name"] for c in inspector.get_columns("registros_rotina")}

    if "justificativa_horario_portaria" in colunas_rotina:
        op.drop_column("registros_rotina", "justificativa_horario_portaria")
    if "impressoes_carteirinha_oficiais" in colunas_conv:
        op.drop_column("conviventes", "impressoes_carteirinha_oficiais")
    if "portaria_excecao_entrada_ate" in colunas_conv:
        op.drop_column("conviventes", "portaria_excecao_entrada_ate")
    if "portaria_excecao_saida_ate" in colunas_conv:
        op.drop_column("conviventes", "portaria_excecao_saida_ate")
    if "portaria_excecao_motivo" in colunas_conv:
        op.drop_column("conviventes", "portaria_excecao_motivo")
