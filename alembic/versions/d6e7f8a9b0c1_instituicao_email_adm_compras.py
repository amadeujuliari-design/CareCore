"""Instituição: e-mail administrativo Compras (mailbox orçamentos).

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-08-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from compras_emails_adm_projetos import EMAILS_ADM_COMPRAS_AEB

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "instituicoes" not in inspector.get_table_names():
        return

    cols = _cols(inspector, "instituicoes")
    if "email_adm_compras" not in cols:
        op.add_column(
            "instituicoes",
            sa.Column("email_adm_compras", sa.String(), nullable=True),
        )

    # Carga inicial AEB (idempotente: só preenche se vazio).
    for nome, email in EMAILS_ADM_COMPRAS_AEB.items():
        bind.execute(
            sa.text(
                """
                UPDATE instituicoes
                SET email_adm_compras = :email
                WHERE nome_fantasia = :nome
                  AND (email_adm_compras IS NULL OR TRIM(email_adm_compras) = '')
                """
            ),
            {"email": email, "nome": nome},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instituicoes" not in inspector.get_table_names():
        return
    if "email_adm_compras" in _cols(inspector, "instituicoes"):
        op.drop_column("instituicoes", "email_adm_compras")
