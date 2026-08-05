"""Migration: numero de cadastro nos agentes captadores NFP."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "nfp_agentes_captadores" not in tabelas:
        return

    cols = {c["name"] for c in inspector.get_columns("nfp_agentes_captadores")}
    if "numero_cadastro" not in cols:
        op.add_column(
            "nfp_agentes_captadores",
            sa.Column("numero_cadastro", sa.Integer(), nullable=True),
        )

    # Backfill sequencial por organizacao (ordem de criacao / codigo).
    rows = bind.execute(
        sa.text(
            """
            SELECT id, organizacao_id
            FROM nfp_agentes_captadores
            WHERE numero_cadastro IS NULL
            ORDER BY organizacao_id, criado_em, codigo, id
            """
        )
    ).fetchall()
    contadores: dict[str, int] = {}
    for row in rows:
        org = row[1]
        contadores[org] = contadores.get(org, 0) + 1
        bind.execute(
            sa.text(
                "UPDATE nfp_agentes_captadores SET numero_cadastro = :n WHERE id = :id"
            ),
            {"n": contadores[org], "id": row[0]},
        )

    # Garante valor em qualquer residual e torna NOT NULL.
    bind.execute(
        sa.text(
            "UPDATE nfp_agentes_captadores SET numero_cadastro = 0 WHERE numero_cadastro IS NULL"
        )
    )

    with op.batch_alter_table("nfp_agentes_captadores") as batch:
        batch.alter_column("numero_cadastro", existing_type=sa.Integer(), nullable=False)
        batch.create_unique_constraint("uq_nfp_agentes_org_numero", ["organizacao_id", "numero_cadastro"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_agentes_captadores" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("nfp_agentes_captadores")}
    if "numero_cadastro" not in cols:
        return
    with op.batch_alter_table("nfp_agentes_captadores") as batch:
        batch.drop_constraint("uq_nfp_agentes_org_numero", type_="unique")
        batch.drop_column("numero_cadastro")
