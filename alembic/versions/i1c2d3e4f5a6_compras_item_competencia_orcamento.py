"""Compras: competência de orçamento no item + sanitização Manutenção.

Revision ID: i1c2d3e4f5a6
Revises: h0b1c2d3e4f5
Create Date: 2026-08-24
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "i1c2d3e4f5a6"
down_revision: Union[str, None] = "h0b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def _norm(texto: str) -> str:
    bruto = (texto or "").casefold()
    for a, b in (
        ("á", "a"), ("à", "a"), ("ã", "a"), ("â", "a"),
        ("é", "e"), ("ê", "e"),
        ("í", "i"),
        ("ó", "o"), ("ô", "o"), ("õ", "o"),
        ("ú", "u"),
        ("ç", "c"),
    ):
        bruto = bruto.replace(a, b)
    return bruto


def _destino(descricao: str) -> tuple[str, str, str]:
    """Retorna (categoria_alvo, segmento, competencia)."""
    d = _norm(descricao)
    if any(x in d for x in ("bota ", "botina", "luva de")):
        return "EPI", "consumo", "sede"
    if "percarbonato" in d or "percabonato" in d:
        return "Higiene e limpeza", "consumo", "sede"
    if any(
        x in d
        for x in (
            "casca de pinus",
            "pedras brancas",
            "dolomita",
            "sementes",
            "terra vegetal",
            "liro artificial",
            "lirio artificial",
        )
    ):
        return "Jardim / hortas", "consumo", "sede"
    if any(
        x in d
        for x in (
            "chuveiro ",
            "luminaria",
            "panflon",
            "painel led",
            "ventilador",
            "persiana",
            "torneira",
        )
    ) and "resistencia" not in d:
        return "Bem / imobilizado", "imobilizado", "projeto"
    if any(
        x in d
        for x in (
            "fita ",
            "interruptor",
            "tomada",
            "engate",
            "sifao",
            "miolo de porta",
            "torre de entrada",
            "resistencia",
            "jogo de bitz",
            "jogo de bits",
        )
    ):
        return "Elétrica e hidráulica", "consumo", "sede"
    return "Manutenção", "manutencao", "projeto"


def _garantir_categoria(bind, org_id: str, nome: str, segmento: str) -> str:
    row = bind.execute(
        sa.text(
            "SELECT id FROM compras_categorias "
            "WHERE organizacao_id = :org AND lower(nome) = lower(:nome)"
        ),
        {"org": org_id, "nome": nome},
    ).fetchone()
    if row:
        bind.execute(
            sa.text(
                "UPDATE compras_categorias SET segmento = :seg WHERE id = :id"
            ),
            {"seg": segmento, "id": row[0]},
        )
        return row[0]
    novo_id = str(uuid.uuid4())
    bind.execute(
        sa.text(
            "INSERT INTO compras_categorias "
            "(id, organizacao_id, nome, segmento, ativo, ordem) "
            "VALUES (:id, :org, :nome, :seg, 1, 0)"
        ),
        {"id": novo_id, "org": org_id, "nome": nome, "seg": segmento},
    )
    return novo_id


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_itens_consumo" not in inspector.get_table_names():
        return

    cols = _cols(inspector, "compras_itens_consumo")
    if "competencia_orcamento" not in cols:
        op.add_column(
            "compras_itens_consumo",
            sa.Column(
                "competencia_orcamento",
                sa.String(),
                nullable=False,
                server_default="sede",
            ),
        )

    # Backfill competência pelo segmento da categoria.
    if "compras_categorias" in inspector.get_table_names():
        bind.execute(
            sa.text(
                """
                UPDATE compras_itens_consumo
                SET competencia_orcamento = 'projeto'
                WHERE categoria_id IN (
                    SELECT id FROM compras_categorias
                    WHERE segmento IN ('manutencao', 'imobilizado', 'servico')
                )
                """
            )
        )
        bind.execute(
            sa.text(
                """
                UPDATE compras_itens_consumo
                SET competencia_orcamento = 'sede'
                WHERE categoria_id IS NULL
                   OR categoria_id IN (
                        SELECT id FROM compras_categorias
                        WHERE segmento = 'consumo' OR segmento IS NULL OR segmento = ''
                   )
                """
            )
        )

    # Sanitização: itens ainda na categoria Manutenção.
    manuts = bind.execute(
        sa.text(
            "SELECT id, organizacao_id FROM compras_categorias "
            "WHERE lower(nome) LIKE '%manuten%'"
        )
    ).fetchall()
    for man_id, org_id in manuts:
        itens = bind.execute(
            sa.text(
                "SELECT id, descricao FROM compras_itens_consumo WHERE categoria_id = :cid"
            ),
            {"cid": man_id},
        ).fetchall()
        cache_cat: dict[tuple[str, str], str] = {}
        for item_id, descricao in itens:
            nome_cat, segmento, competencia = _destino(descricao or "")
            chave = (org_id, nome_cat)
            if chave not in cache_cat:
                cache_cat[chave] = _garantir_categoria(bind, org_id, nome_cat, segmento)
            cat_id = cache_cat[chave]
            bind.execute(
                sa.text(
                    "UPDATE compras_itens_consumo "
                    "SET categoria_id = :cat, competencia_orcamento = :comp "
                    "WHERE id = :id"
                ),
                {"cat": cat_id, "comp": competencia, "id": item_id},
            )
        # Categoria Manutenção fica reservada a reparo (projeto).
        bind.execute(
            sa.text(
                "UPDATE compras_categorias SET segmento = 'manutencao' WHERE id = :id"
            ),
            {"id": man_id},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "competencia_orcamento" in _cols(inspector, "compras_itens_consumo"):
        op.drop_column("compras_itens_consumo", "competencia_orcamento")
