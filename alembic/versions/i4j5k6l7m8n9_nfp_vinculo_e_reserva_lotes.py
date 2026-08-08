"""Migration: vinculo NFP do usuario + reserva de lotes de cupons."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i4j5k6l7m8n9"
down_revision: Union[str, None] = "h3i4j5k6l7m8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cols_usuarios = {c["name"] for c in inspector.get_columns("usuarios")}
    if "nfp_captador_vinculo" not in cols_usuarios:
        op.add_column(
            "usuarios",
            sa.Column("nfp_captador_vinculo", sa.String(), nullable=True),
        )

    cols_cupons = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
    if "lote_id" not in cols_cupons:
        op.add_column("nfp_cupons_lidos", sa.Column("lote_id", sa.String(), nullable=True))
    if "reservado_em" not in cols_cupons:
        op.add_column("nfp_cupons_lidos", sa.Column("reservado_em", sa.DateTime(), nullable=True))
    if "reservado_por" not in cols_cupons:
        op.add_column("nfp_cupons_lidos", sa.Column("reservado_por", sa.String(), nullable=True))

    indices = {ix["name"] for ix in inspector.get_indexes("nfp_cupons_lidos")}
    if "ix_nfp_cupom_lido_org_lote" not in indices:
        op.create_index(
            "ix_nfp_cupom_lido_org_lote",
            "nfp_cupons_lidos",
            ["organizacao_id", "lote_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "nfp_cupons_lidos" in set(inspector.get_table_names()):
        indices = {ix["name"] for ix in inspector.get_indexes("nfp_cupons_lidos")}
        if "ix_nfp_cupom_lido_org_lote" in indices:
            op.drop_index("ix_nfp_cupom_lido_org_lote", table_name="nfp_cupons_lidos")
        cols = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
        for col in ("reservado_por", "reservado_em", "lote_id"):
            if col in cols:
                op.drop_column("nfp_cupons_lidos", col)

    if "usuarios" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("usuarios")}
        if "nfp_captador_vinculo" in cols:
            op.drop_column("usuarios", "nfp_captador_vinculo")
