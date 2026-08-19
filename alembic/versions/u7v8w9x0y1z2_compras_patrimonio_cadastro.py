"""Campos de cadastro em compras_patrimonio.

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "u7v8w9x0y1z2"
down_revision: Union[str, None] = "t6u7v8w9x0y1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_patrimonio" not in inspector.get_table_names():
        return
    cols = _colunas(inspector, "compras_patrimonio")
    novos = (
        ("numero_etiqueta", sa.String()),
        ("departamento", sa.String()),
        ("propriedade", sa.String()),
        ("data_aquisicao", sa.Date()),
        ("forma_aquisicao", sa.String()),
        ("situacao", sa.String()),
        ("motivo_baixa", sa.String()),
        ("data_baixa", sa.Date()),
        ("observacao", sa.Text()),
        ("escopo_unidade", sa.String()),
        ("atualizado_em", sa.DateTime()),
    )
    for nome, tipo in novos:
        if nome not in cols:
            server_default = None
            if nome == "escopo_unidade":
                server_default = sa.text("'projeto'")
            elif nome == "propriedade":
                server_default = sa.text("'aeb'")
            elif nome == "situacao":
                server_default = sa.text("'bom'")
            op.add_column(
                "compras_patrimonio",
                sa.Column(nome, tipo, nullable=True if nome != "escopo_unidade" else False, server_default=server_default),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_patrimonio" not in inspector.get_table_names():
        return
    cols = _colunas(inspector, "compras_patrimonio")
    for nome in (
        "atualizado_em",
        "escopo_unidade",
        "observacao",
        "data_baixa",
        "motivo_baixa",
        "situacao",
        "forma_aquisicao",
        "data_aquisicao",
        "propriedade",
        "departamento",
        "numero_etiqueta",
    ):
        if nome in cols:
            op.drop_column("compras_patrimonio", nome)
