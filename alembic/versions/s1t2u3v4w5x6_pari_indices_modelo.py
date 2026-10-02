"""Alinha os índices do PARI aos nomes do modelo.

Revision ID: s1t2u3v4w5x6
Revises: r0s1t2u3v4w5
Create Date: 2026-10-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "s1t2u3v4w5x6"
down_revision: Union[str, None] = "r0s1t2u3v4w5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDICES = (
    ("ix_conviventes_familia_id", "conviventes", ["familia_id"]),
    ("ix_familias_convivente_codigo", "familias_convivente", ["codigo"]),
    ("ix_familias_convivente_instituicao_id", "familias_convivente", ["instituicao_id"]),
    ("ix_itens_higiene_instituicao_id", "itens_higiene", ["instituicao_id"]),
    ("ix_kit_higiene_entregas_competencia", "kit_higiene_entregas", ["competencia"]),
    ("ix_kit_higiene_entregas_familia_id", "kit_higiene_entregas", ["familia_id"]),
    ("ix_kit_higiene_entregas_instituicao_id", "kit_higiene_entregas", ["instituicao_id"]),
    ("ix_kit_higiene_regras_instituicao_id", "kit_higiene_regras", ["instituicao_id"]),
    ("ix_lavanderia_agenda_convivente_id", "lavanderia_agenda", ["convivente_id"]),
    ("ix_lavanderia_agenda_inicio", "lavanderia_agenda", ["inicio"]),
    ("ix_lavanderia_agenda_instituicao_id", "lavanderia_agenda", ["instituicao_id"]),
    ("ix_lavanderia_agenda_maquina", "lavanderia_agenda", ["maquina"]),
    ("ix_tipos_individuo_higiene_instituicao_id", "tipos_individuo_higiene", ["instituicao_id"]),
)


def _nomes_indice(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {indice["name"] for indice in inspector.get_indexes(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    nomes_familia = _nomes_indice(inspector, "familias_convivente")
    if "ix_familias_convivente_instituicao" in nomes_familia:
        op.drop_index("ix_familias_convivente_instituicao", table_name="familias_convivente")

    inspector = sa.inspect(bind)
    for nome, tabela, colunas in _INDICES:
        if nome in _nomes_indice(inspector, tabela):
            continue
        if tabela not in inspector.get_table_names():
            continue
        op.create_index(nome, tabela, colunas)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for nome, tabela, _colunas in _INDICES:
        if nome in _nomes_indice(inspector, tabela):
            op.drop_index(nome, table_name=tabela)
    inspector = sa.inspect(bind)
    if (
        "familias_convivente" in inspector.get_table_names()
        and "ix_familias_convivente_instituicao" not in _nomes_indice(inspector, "familias_convivente")
    ):
        op.create_index(
            "ix_familias_convivente_instituicao",
            "familias_convivente",
            ["instituicao_id"],
        )
