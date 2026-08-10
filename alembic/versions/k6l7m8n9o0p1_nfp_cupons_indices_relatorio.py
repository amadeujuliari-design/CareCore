"""Indices de performance para fila/relatorio de cupons NFP."""

from typing import Sequence, Union

from alembic import op


revision: str = "k6l7m8n9o0p1"
down_revision: Union[str, None] = "j5k6l7m8n9o0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_nfp_cupom_lido_org_captador_lido_em",
        "nfp_cupons_lidos",
        ["organizacao_id", "captador", "lido_em"],
        unique=False,
    )
    op.create_index(
        "ix_nfp_cupom_lido_org_enviado_em",
        "nfp_cupons_lidos",
        ["organizacao_id", "enviado_em"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_nfp_cupom_lido_org_enviado_em", table_name="nfp_cupons_lidos")
    op.drop_index("ix_nfp_cupom_lido_org_captador_lido_em", table_name="nfp_cupons_lidos")
