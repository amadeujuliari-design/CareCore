"""Migration: fila de cupons lidos NFP (leitura QR)."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g2h3i4j5k6l7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_cupons_lidos" not in tabelas:
        op.create_table(
            "nfp_cupons_lidos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("chave", sa.String(), nullable=False),
            sa.Column("captador", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("consumidor_identificado", sa.Boolean(), nullable=True),
            sa.Column("cnpj_emitente", sa.String(), nullable=True),
            sa.Column("data_emissao_ref", sa.String(), nullable=True),
            sa.Column("qr_bruto", sa.Text(), nullable=True),
            sa.Column("url_consulta", sa.String(), nullable=True),
            sa.Column("mensagem", sa.Text(), nullable=True),
            sa.Column("lido_por_usuario_id", sa.String(), nullable=True),
            sa.Column("lido_em", sa.DateTime(), nullable=True),
            sa.Column("enviado_em", sa.DateTime(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.ForeignKeyConstraint(["lido_por_usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organizacao_id", "chave", name="uq_nfp_cupom_lido_org_chave"),
        )

    indices = {ix["name"] for ix in sa.inspect(bind).get_indexes("nfp_cupons_lidos")}
    if "ix_nfp_cupom_lido_org_status" not in indices:
        op.create_index(
            "ix_nfp_cupom_lido_org_status",
            "nfp_cupons_lidos",
            ["organizacao_id", "status"],
        )
    if "ix_nfp_cupom_lido_org_lido_em" not in indices:
        op.create_index(
            "ix_nfp_cupom_lido_org_lido_em",
            "nfp_cupons_lidos",
            ["organizacao_id", "lido_em"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cupons_lidos" not in set(inspector.get_table_names()):
        return
    indices = {ix["name"] for ix in inspector.get_indexes("nfp_cupons_lidos")}
    if "ix_nfp_cupom_lido_org_lido_em" in indices:
        op.drop_index("ix_nfp_cupom_lido_org_lido_em", table_name="nfp_cupons_lidos")
    if "ix_nfp_cupom_lido_org_status" in indices:
        op.drop_index("ix_nfp_cupom_lido_org_status", table_name="nfp_cupons_lidos")
    op.drop_table("nfp_cupons_lidos")
