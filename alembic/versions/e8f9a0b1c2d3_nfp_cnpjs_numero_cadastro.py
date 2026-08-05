"""Migration: numero_cadastro em nfp_cnpjs_lojas."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cnpjs_lojas" not in set(inspector.get_table_names()):
        return

    cols = {c["name"] for c in inspector.get_columns("nfp_cnpjs_lojas")}
    if "numero_cadastro" not in cols:
        op.add_column(
            "nfp_cnpjs_lojas",
            sa.Column("numero_cadastro", sa.Integer(), nullable=True),
        )

    orgs = bind.execute(
        sa.text("SELECT DISTINCT organizacao_id FROM nfp_cnpjs_lojas")
    ).fetchall()

    for (org_id,) in orgs:
        rows = bind.execute(
            sa.text(
                """
                SELECT id FROM nfp_cnpjs_lojas
                WHERE organizacao_id = :org
                ORDER BY loja COLLATE NOCASE, cnpj, id
                """
            ),
            {"org": org_id},
        ).fetchall()
        n = 0
        for (row_id,) in rows:
            n += 1
            bind.execute(
                sa.text(
                    "UPDATE nfp_cnpjs_lojas SET numero_cadastro = :n WHERE id = :id"
                ),
                {"n": n, "id": row_id},
            )

    bind.execute(
        sa.text(
            "UPDATE nfp_cnpjs_lojas SET numero_cadastro = 0 WHERE numero_cadastro IS NULL"
        )
    )

    with op.batch_alter_table("nfp_cnpjs_lojas") as batch:
        batch.alter_column("numero_cadastro", existing_type=sa.Integer(), nullable=False)
        batch.create_unique_constraint(
            "uq_nfp_cnpjs_org_numero",
            ["organizacao_id", "numero_cadastro"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cnpjs_lojas" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("nfp_cnpjs_lojas")}
    if "numero_cadastro" not in cols:
        return
    with op.batch_alter_table("nfp_cnpjs_lojas") as batch:
        batch.drop_constraint("uq_nfp_cnpjs_org_numero", type_="unique")
        batch.drop_column("numero_cadastro")
