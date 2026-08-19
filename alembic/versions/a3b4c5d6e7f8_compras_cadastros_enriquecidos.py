"""Enriquece cadastros de Compras (item, fornecedor, fonte, patrimonio).

Revision ID: a3b4c5d6e7f8
Revises: z2a3b4c5d6e7
Create Date: 2026-08-19
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from compras_regras import inferir_fator_embalagem, inferir_perecivel, inferir_tipo_fonte

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "z2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "compras_categorias" in tabelas:
        cols = _cols(inspector, "compras_categorias")
        if "ordem" not in cols:
            op.add_column(
                "compras_categorias",
                sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
            )

    if "compras_itens_consumo" in tabelas:
        cols = _cols(inspector, "compras_itens_consumo")
        if "sinonimos" not in cols:
            op.add_column("compras_itens_consumo", sa.Column("sinonimos", sa.Text(), nullable=True))
        if "fator_embalagem" not in cols:
            op.add_column("compras_itens_consumo", sa.Column("fator_embalagem", sa.Float(), nullable=True))
        if "perecivel" not in cols:
            op.add_column(
                "compras_itens_consumo",
                sa.Column("perecivel", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
        if "equivalente_item_id" not in cols:
            op.add_column("compras_itens_consumo", sa.Column("equivalente_item_id", sa.String(), nullable=True))

    if "compras_fontes_recurso" in tabelas:
        cols = _cols(inspector, "compras_fontes_recurso")
        if "tipo" not in cols:
            op.add_column(
                "compras_fontes_recurso",
                sa.Column("tipo", sa.String(), nullable=False, server_default="outros"),
            )
        if "vigencia_inicio" not in cols:
            op.add_column("compras_fontes_recurso", sa.Column("vigencia_inicio", sa.Date(), nullable=True))
        if "vigencia_fim" not in cols:
            op.add_column("compras_fontes_recurso", sa.Column("vigencia_fim", sa.Date(), nullable=True))

    if "compras_fornecedores" in tabelas:
        cols = _cols(inspector, "compras_fornecedores")
        if "prazo_entrega_dias" not in cols:
            op.add_column("compras_fornecedores", sa.Column("prazo_entrega_dias", sa.Integer(), nullable=True))

    if "compras_patrimonio" in tabelas:
        cols = _cols(inspector, "compras_patrimonio")
        if "categoria_id" not in cols:
            op.add_column("compras_patrimonio", sa.Column("categoria_id", sa.String(), nullable=True))

    inspector = sa.inspect(bind)
    if "compras_fornecedor_categorias" not in inspector.get_table_names():
        op.create_table(
            "compras_fornecedor_categorias",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("fornecedor_id", sa.String(), nullable=False),
            sa.Column("categoria_id", sa.String(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("fornecedor_id", "categoria_id", name="uq_compras_fornecedor_categoria"),
        )
        op.create_index(
            "ix_compras_fornecedor_cat_forn",
            "compras_fornecedor_categorias",
            ["fornecedor_id"],
        )

    fontes = bind.execute(sa.text("SELECT id, nome FROM compras_fontes_recurso")).fetchall() if "compras_fontes_recurso" in tabelas else []
    for fonte_id, nome in fontes:
        bind.execute(
            sa.text("UPDATE compras_fontes_recurso SET tipo = :tipo WHERE id = :id"),
            {"tipo": inferir_tipo_fonte(nome), "id": fonte_id},
        )

    if "compras_itens_consumo" in tabelas:
        itens = bind.execute(
            sa.text(
                "SELECT i.id, i.embalagem, i.descricao, c.nome "
                "FROM compras_itens_consumo i "
                "LEFT JOIN compras_categorias c ON c.id = i.categoria_id"
            )
        ).fetchall()
        for item_id, embalagem, descricao, cat_nome in itens:
            fator = inferir_fator_embalagem(embalagem)
            if fator is not None:
                bind.execute(
                    sa.text(
                        "UPDATE compras_itens_consumo "
                        "SET fator_embalagem = COALESCE(fator_embalagem, :fator) "
                        "WHERE id = :id"
                    ),
                    {"fator": fator, "id": item_id},
                )
            if inferir_perecivel(categoria_nome=cat_nome, descricao=descricao):
                bind.execute(
                    sa.text("UPDATE compras_itens_consumo SET perecivel = :flag WHERE id = :id"),
                    {"flag": True, "id": item_id},
                )

    if "compras_fornecedores" in tabelas and "compras_fornecedor_categorias" in sa.inspect(bind).get_table_names():
        existentes = {
            (row[0], row[1])
            for row in bind.execute(
                sa.text("SELECT fornecedor_id, categoria_id FROM compras_fornecedor_categorias")
            ).fetchall()
        }
        fornecedores = bind.execute(
            sa.text("SELECT id, categoria_id FROM compras_fornecedores WHERE categoria_id IS NOT NULL")
        ).fetchall()
        for forn_id, cat_id in fornecedores:
            if not cat_id or (forn_id, cat_id) in existentes:
                continue
            bind.execute(
                sa.text(
                    "INSERT INTO compras_fornecedor_categorias (id, fornecedor_id, categoria_id, criado_em) "
                    "VALUES (:id, :fornecedor_id, :categoria_id, CURRENT_TIMESTAMP)"
                ),
                {"id": str(uuid.uuid4()), "fornecedor_id": forn_id, "categoria_id": cat_id},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_fornecedor_categorias" in inspector.get_table_names():
        op.drop_index("ix_compras_fornecedor_cat_forn", table_name="compras_fornecedor_categorias")
        op.drop_table("compras_fornecedor_categorias")
