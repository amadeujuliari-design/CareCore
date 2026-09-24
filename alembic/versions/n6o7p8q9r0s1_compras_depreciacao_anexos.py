"""Categoria: depreciação anual. Patrimônio: vários anexos. Unifica higiene.

Revision ID: n6o7p8q9r0s1
Revises: m5n6o7p8q9r0
Create Date: 2026-09-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "n6o7p8q9r0s1"
down_revision: Union[str, None] = "m5n6o7p8q9r0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _unificar_higiene(bind) -> None:
    inspector = sa.inspect(bind)
    if "compras_categorias" not in inspector.get_table_names():
        return
    rows = bind.execute(
        sa.text("SELECT id, organizacao_id, nome FROM compras_categorias")
    ).fetchall()
    por_org: dict[str, dict[str, str]] = {}
    for row in rows:
        org = row[1]
        nome = (row[2] or "").strip().lower()
        por_org.setdefault(org, {})[nome] = row[0]

    def _mover(origem: str, destino: str) -> None:
        if not origem or origem == destino:
            return
        for tabela in ("compras_itens_consumo", "compras_patrimonio", "compras_pedido_itens"):
            if tabela not in inspector.get_table_names():
                continue
            colunas = {c["name"] for c in inspector.get_columns(tabela)}
            if "categoria_id" not in colunas:
                continue
            bind.execute(
                sa.text(f"UPDATE {tabela} SET categoria_id = :destino WHERE categoria_id = :origem"),
                {"destino": destino, "origem": origem},
            )
        bind.execute(
            sa.text("DELETE FROM compras_categorias WHERE id = :origem"),
            {"origem": origem},
        )

    for nomes in por_org.values():
        higiene = nomes.get("higiene")
        limpeza = nomes.get("higiene e limpeza")
        pessoal = nomes.get("higiene pessoal")
        destino = higiene or limpeza or pessoal
        if not destino:
            continue
        if not higiene:
            bind.execute(
                sa.text("UPDATE compras_categorias SET nome = 'Higiene' WHERE id = :id"),
                {"id": destino},
            )
        alvo = higiene or destino
        if pessoal and pessoal != alvo:
            _mover(pessoal, alvo)
        if limpeza and limpeza != alvo:
            _mover(limpeza, alvo)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_categorias" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("compras_categorias")}
        if "depreciacao_anual_percentual" not in cols:
            op.add_column(
                "compras_categorias",
                sa.Column("depreciacao_anual_percentual", sa.Float(), nullable=True),
            )
    if "compras_patrimonio_anexos" not in inspector.get_table_names():
        op.create_table(
            "compras_patrimonio_anexos",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("patrimonio_id", sa.String(), sa.ForeignKey("compras_patrimonio.id"), nullable=False),
            sa.Column("nome_arquivo", sa.String(), nullable=False),
            sa.Column("caminho_arquivo", sa.String(), nullable=False),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("tamanho_bytes", sa.Integer(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_compras_patrimonio_anexo_item",
            "compras_patrimonio_anexos",
            ["patrimonio_id"],
        )
    _unificar_higiene(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_patrimonio_anexos" in inspector.get_table_names():
        op.drop_index("ix_compras_patrimonio_anexo_item", table_name="compras_patrimonio_anexos")
        op.drop_table("compras_patrimonio_anexos")
    if "compras_categorias" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("compras_categorias")}
        if "depreciacao_anual_percentual" in cols:
            op.drop_column("compras_categorias", "depreciacao_anual_percentual")
