"""Compras: código curto do grupo de envio (N-DD/MM/AAAA).

Revision ID: g9a0b1c2d3e4
Revises: f8a9b0c1d2e3
Create Date: 2026-08-24
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "g9a0b1c2d3e4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def _parse_dt(valor):
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor
    texto = str(valor).strip()
    if not texto:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(texto[:26], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(texto.replace("Z", ""))
    except ValueError:
        return None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "compras_pedidos" not in inspector.get_table_names():
        return
    cols = _cols(inspector, "compras_pedidos")
    if "grupo_codigo" not in cols:
        op.add_column("compras_pedidos", sa.Column("grupo_codigo", sa.String(), nullable=True))

    # Backfill: um código por grupo_split_id, sequencial por projeto/dia.
    rows = bind.execute(
        sa.text(
            """
            SELECT id, instituicao_id, grupo_split_id, submetido_em, criado_em
            FROM compras_pedidos
            WHERE grupo_split_id IS NOT NULL AND grupo_split_id != ''
            """
        )
    ).fetchall()
    if not rows:
        return

    por_grupo: dict[str, dict] = {}
    for row in rows:
        gid = row[2]
        dt = _parse_dt(row[3]) or _parse_dt(row[4]) or datetime(1970, 1, 1)
        atual = por_grupo.get(gid)
        if atual is None or dt < atual["dt"]:
            por_grupo[gid] = {
                "instituicao_id": row[1],
                "dt": dt,
            }

    por_inst_dia: dict[tuple[str, str], list[tuple[str, datetime]]] = defaultdict(list)
    for gid, meta in por_grupo.items():
        inst = meta["instituicao_id"] or ""
        dia = meta["dt"].strftime("%d/%m/%Y")
        por_inst_dia[(inst, dia)].append((gid, meta["dt"]))

    updates: list[tuple[str, str]] = []
    for (inst, dia), grupos in por_inst_dia.items():
        grupos_ord = sorted(grupos, key=lambda x: (x[1], x[0]))
        for idx, (gid, _) in enumerate(grupos_ord, start=1):
            codigo = f"{idx}-{dia}"
            updates.append((codigo, gid))

    for codigo, gid in updates:
        bind.execute(
            sa.text(
                "UPDATE compras_pedidos SET grupo_codigo = :codigo "
                "WHERE grupo_split_id = :gid AND (grupo_codigo IS NULL OR grupo_codigo = '')"
            ),
            {"codigo": codigo, "gid": gid},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "grupo_codigo" in _cols(inspector, "compras_pedidos"):
        op.drop_column("compras_pedidos", "grupo_codigo")
