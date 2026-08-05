"""Migration: vinculo CNPJ x captador por competencia NFP."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_cnpjs_captacao_competencia" not in tabelas:
        op.create_table(
            "nfp_cnpjs_captacao_competencia",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("cnpj", sa.String(), nullable=False),
            sa.Column("captador", sa.String(), nullable=False),
            sa.Column("loja", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "organizacao_id",
                "competencia",
                "cnpj",
                name="uq_nfp_cnpj_captacao_org_comp_cnpj",
            ),
        )

    indices = {ix["name"] for ix in sa.inspect(bind).get_indexes("nfp_cnpjs_captacao_competencia")}
    if "ix_nfp_cnpj_captacao_org_comp" not in indices:
        op.create_index(
            "ix_nfp_cnpj_captacao_org_comp",
            "nfp_cnpjs_captacao_competencia",
            ["organizacao_id", "competencia"],
        )
    if "ix_nfp_cnpj_captacao_org_cnpj" not in indices:
        op.create_index(
            "ix_nfp_cnpj_captacao_org_cnpj",
            "nfp_cnpjs_captacao_competencia",
            ["organizacao_id", "cnpj"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cnpjs_captacao_competencia" not in set(inspector.get_table_names()):
        return
    indices = {ix["name"] for ix in inspector.get_indexes("nfp_cnpjs_captacao_competencia")}
    if "ix_nfp_cnpj_captacao_org_cnpj" in indices:
        op.drop_index("ix_nfp_cnpj_captacao_org_cnpj", table_name="nfp_cnpjs_captacao_competencia")
    if "ix_nfp_cnpj_captacao_org_comp" in indices:
        op.drop_index("ix_nfp_cnpj_captacao_org_comp", table_name="nfp_cnpjs_captacao_competencia")
    op.drop_table("nfp_cnpjs_captacao_competencia")
