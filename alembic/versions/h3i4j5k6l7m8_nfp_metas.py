"""Migration: tabelas Metas NFP (rateio mensal por projeto)."""

from alembic import op
import sqlalchemy as sa


revision = "h3i4j5k6l7m8"
down_revision = "g2h3i4j5k6l7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_metas_competencias" not in tabelas:
        op.create_table(
            "nfp_metas_competencias",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("ref_credito", sa.String(), nullable=True),
            sa.Column("titulo", sa.String(), nullable=True),
            sa.Column("pct_fundo", sa.Float(), nullable=False, server_default="0.3"),
            sa.Column("pct_soulcial", sa.Float(), nullable=False, server_default="0.2"),
            sa.Column("pct_fundo_soulcial", sa.Float(), nullable=False, server_default="0.1"),
            sa.Column("pct_premiacao", sa.Float(), nullable=False, server_default="0.1"),
            sa.Column("pct_diego", sa.Float(), nullable=False, server_default="0.5"),
            sa.Column("f35_digitado", sa.Float(), nullable=False, server_default="0"),
            sa.Column("f36_doado", sa.Float(), nullable=False, server_default="0"),
            sa.Column("soulcial_base", sa.Float(), nullable=False, server_default="0"),
            sa.Column("total_captador", sa.Float(), nullable=False, server_default="0"),
            sa.Column("digitadas_diego", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("data_liberacao_credito", sa.String(), nullable=True),
            sa.Column("observacoes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="rascunho"),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organizacao_id", "competencia", name="uq_nfp_metas_org_competencia"),
        )
        op.create_index(
            "ix_nfp_metas_org_competencia",
            "nfp_metas_competencias",
            ["organizacao_id", "competencia"],
        )

    if "nfp_metas_linhas" not in tabelas:
        op.create_table(
            "nfp_metas_linhas",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "competencia_id",
                sa.String(),
                sa.ForeignKey("nfp_metas_competencias.id"),
                nullable=False,
            ),
            sa.Column("codigo_projeto", sa.String(), nullable=False),
            sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("digitadas", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("doadas", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("soulcial", sa.Float(), nullable=False, server_default="0"),
            sa.Column("soulcial_campanhas", sa.Float(), nullable=False, server_default="0"),
            sa.Column("pct_digitadas", sa.Float(), nullable=False, server_default="0"),
            sa.Column("pct_doadas", sa.Float(), nullable=False, server_default="0"),
            sa.Column("valor_digitado", sa.Float(), nullable=False, server_default="0"),
            sa.Column("valor_aplicativo", sa.Float(), nullable=False, server_default="0"),
            sa.Column("valor_total", sa.Float(), nullable=False, server_default="0"),
            sa.Column("diego", sa.Float(), nullable=False, server_default="0"),
            sa.Column("total", sa.Float(), nullable=False, server_default="0"),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("competencia_id", "codigo_projeto", name="uq_nfp_metas_linha_comp_proj"),
        )
        op.create_index("ix_nfp_metas_linha_comp", "nfp_metas_linhas", ["competencia_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())
    if "nfp_metas_linhas" in tabelas:
        op.drop_index("ix_nfp_metas_linha_comp", table_name="nfp_metas_linhas")
        op.drop_table("nfp_metas_linhas")
    if "nfp_metas_competencias" in tabelas:
        op.drop_index("ix_nfp_metas_org_competencia", table_name="nfp_metas_competencias")
        op.drop_table("nfp_metas_competencias")
