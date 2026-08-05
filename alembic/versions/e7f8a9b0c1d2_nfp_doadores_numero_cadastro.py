"""Migration: numero_cadastro em nfp_doadores (1-9 legados + demais)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_doadores" not in set(inspector.get_table_names()):
        return

    cols = {c["name"] for c in inspector.get_columns("nfp_doadores")}
    if "numero_cadastro" not in cols:
        op.add_column(
            "nfp_doadores",
            sa.Column("numero_cadastro", sa.Integer(), nullable=True),
        )

    orgs = bind.execute(
        sa.text("SELECT DISTINCT organizacao_id FROM nfp_doadores")
    ).fetchall()

    for (org_id,) in orgs:
        # 1) Cadastros legados/manuais (nao vieram da sync de doacao) → 1..N
        legados = bind.execute(
            sa.text(
                """
                SELECT id FROM nfp_doadores
                WHERE organizacao_id = :org
                  AND (origem_cadastro IS NULL OR origem_cadastro <> 'DOACAO_AUTOMATICA')
                ORDER BY nome COLLATE NOCASE, cpf, id
                """
            ),
            {"org": org_id},
        ).fetchall()

        n = 0
        for (row_id,) in legados:
            n += 1
            bind.execute(
                sa.text(
                    "UPDATE nfp_doadores SET numero_cadastro = :n WHERE id = :id"
                ),
                {"n": n, "id": row_id},
            )

        # 2) Demais (doacao automatica) continuam apos os legados
        demais = bind.execute(
            sa.text(
                """
                SELECT id FROM nfp_doadores
                WHERE organizacao_id = :org
                  AND origem_cadastro = 'DOACAO_AUTOMATICA'
                ORDER BY cpf, id
                """
            ),
            {"org": org_id},
        ).fetchall()

        for (row_id,) in demais:
            n += 1
            bind.execute(
                sa.text(
                    "UPDATE nfp_doadores SET numero_cadastro = :n WHERE id = :id"
                ),
                {"n": n, "id": row_id},
            )

        # Residual sem numero
        residual = bind.execute(
            sa.text(
                """
                SELECT id FROM nfp_doadores
                WHERE organizacao_id = :org AND numero_cadastro IS NULL
                ORDER BY nome COLLATE NOCASE, cpf, id
                """
            ),
            {"org": org_id},
        ).fetchall()
        for (row_id,) in residual:
            n += 1
            bind.execute(
                sa.text(
                    "UPDATE nfp_doadores SET numero_cadastro = :n WHERE id = :id"
                ),
                {"n": n, "id": row_id},
            )

    bind.execute(
        sa.text("UPDATE nfp_doadores SET numero_cadastro = 0 WHERE numero_cadastro IS NULL")
    )

    with op.batch_alter_table("nfp_doadores") as batch:
        batch.alter_column("numero_cadastro", existing_type=sa.Integer(), nullable=False)
        batch.create_unique_constraint(
            "uq_nfp_doadores_org_numero",
            ["organizacao_id", "numero_cadastro"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_doadores" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("nfp_doadores")}
    if "numero_cadastro" not in cols:
        return
    with op.batch_alter_table("nfp_doadores") as batch:
        batch.drop_constraint("uq_nfp_doadores_org_numero", type_="unique")
        batch.drop_column("numero_cadastro")
