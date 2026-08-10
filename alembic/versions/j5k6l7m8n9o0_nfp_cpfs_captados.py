"""Migration: CPFs captados por agentes NFP."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j5k6l7m8n9o0"
down_revision: Union[str, None] = "i4j5k6l7m8n9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cpfs_captados" in set(inspector.get_table_names()):
        return

    op.create_table(
        "nfp_cpfs_captados",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
        sa.Column("numero_cadastro", sa.Integer(), nullable=False),
        sa.Column("cpf", sa.String(), nullable=False),
        sa.Column("nome", sa.String(), nullable=True),
        sa.Column("captador", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("telefone", sa.String(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organizacao_id", "cpf", name="uq_nfp_cpfs_captados_org_cpf"),
        sa.UniqueConstraint("organizacao_id", "numero_cadastro", name="uq_nfp_cpfs_captados_org_numero"),
    )
    op.create_index("ix_nfp_cpfs_captados_organizacao", "nfp_cpfs_captados", ["organizacao_id"])
    op.create_index(
        "ix_nfp_cpfs_captados_captador",
        "nfp_cpfs_captados",
        ["organizacao_id", "captador"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cpfs_captados" not in set(inspector.get_table_names()):
        return
    op.drop_index("ix_nfp_cpfs_captados_captador", table_name="nfp_cpfs_captados")
    op.drop_index("ix_nfp_cpfs_captados_organizacao", table_name="nfp_cpfs_captados")
    op.drop_table("nfp_cpfs_captados")
