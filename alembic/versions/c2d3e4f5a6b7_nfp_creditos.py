"""Migration: tabelas do modulo NFP – Creditos."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b2c3d4e5f6a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "nfp_doadores" not in tabelas:
        op.create_table(
            "nfp_doadores",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("telefone", sa.String(), nullable=True),
            sa.Column("cpf", sa.String(), nullable=False),
            sa.Column("unidade_captador", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organizacao_id", "cpf", name="uq_nfp_doadores_org_cpf"),
        )
        op.create_index("ix_nfp_doadores_organizacao", "nfp_doadores", ["organizacao_id"])

    if "nfp_cnpjs_lojas" not in tabelas:
        op.create_table(
            "nfp_cnpjs_lojas",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("cnpj", sa.String(), nullable=False),
            sa.Column("loja", sa.String(), nullable=True),
            sa.Column("captador", sa.String(), nullable=True),
            sa.Column("cnpj_conferir", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organizacao_id", "cnpj", name="uq_nfp_cnpjs_org_cnpj"),
        )
        op.create_index("ix_nfp_cnpjs_organizacao", "nfp_cnpjs_lojas", ["organizacao_id"])
        op.create_index("ix_nfp_cnpjs_captador", "nfp_cnpjs_lojas", ["organizacao_id", "captador"])

    if "nfp_doacoes_automaticas" not in tabelas:
        op.create_table(
            "nfp_doacoes_automaticas",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("numero_nota", sa.String(), nullable=True),
            sa.Column("valor_nota", sa.Float(), nullable=True),
            sa.Column("valor_nota_centavos", sa.Integer(), nullable=True),
            sa.Column("data_nota", sa.String(), nullable=True),
            sa.Column("cnpj_entidade_social", sa.String(), nullable=True),
            sa.Column("cpf_doador_cadastrador", sa.String(), nullable=True),
            sa.Column("data_pedido", sa.String(), nullable=True),
            sa.Column("status_pedido", sa.String(), nullable=True),
            sa.Column("tipo_doacao", sa.String(), nullable=True),
            sa.Column("cnpj_estabelecimento", sa.String(), nullable=True),
            sa.Column("chave", sa.String(), nullable=True),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_nfp_doacoes_org_comp", "nfp_doacoes_automaticas", ["organizacao_id", "competencia"])
        op.create_index("ix_nfp_doacoes_chave", "nfp_doacoes_automaticas", ["organizacao_id", "competencia", "chave"])

    if "nfp_sefaz_creditos" not in tabelas:
        op.create_table(
            "nfp_sefaz_creditos",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("cnpj_emitente", sa.String(), nullable=True),
            sa.Column("emitente", sa.String(), nullable=True),
            sa.Column("numero_nota", sa.String(), nullable=True),
            sa.Column("data_emissao", sa.String(), nullable=True),
            sa.Column("valor_nf", sa.Float(), nullable=True),
            sa.Column("valor_nf_centavos", sa.Integer(), nullable=True),
            sa.Column("data_registro", sa.String(), nullable=True),
            sa.Column("creditos", sa.Float(), nullable=True),
            sa.Column("creditos_centavos", sa.Integer(), nullable=True),
            sa.Column("situacao_credito", sa.String(), nullable=True),
            sa.Column("chave", sa.String(), nullable=True),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_nfp_sefaz_org_comp", "nfp_sefaz_creditos", ["organizacao_id", "competencia"])
        op.create_index("ix_nfp_sefaz_cnpj", "nfp_sefaz_creditos", ["organizacao_id", "cnpj_emitente"])
        op.create_index("ix_nfp_sefaz_chave", "nfp_sefaz_creditos", ["organizacao_id", "competencia", "chave"])

    if "nfp_rateio" not in tabelas:
        op.create_table(
            "nfp_rateio",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("cnpj", sa.String(), nullable=True),
            sa.Column("loja", sa.String(), nullable=True),
            sa.Column("captador", sa.String(), nullable=True),
            sa.Column("origem", sa.String(), nullable=True),
            sa.Column("retorno", sa.Float(), nullable=True),
            sa.Column("retorno_centavos", sa.Integer(), nullable=True),
            sa.Column("qtd", sa.Integer(), nullable=True),
            sa.Column("aeb", sa.Float(), nullable=True),
            sa.Column("aeb_centavos", sa.Integer(), nullable=True),
            sa.Column("credito_liquido", sa.Float(), nullable=True),
            sa.Column("credito_liquido_centavos", sa.Integer(), nullable=True),
            sa.Column("valor_diego", sa.Float(), nullable=True),
            sa.Column("valor_diego_centavos", sa.Integer(), nullable=True),
            sa.Column("valor_aeb", sa.Float(), nullable=True),
            sa.Column("valor_aeb_centavos", sa.Integer(), nullable=True),
            sa.Column("final", sa.Float(), nullable=True),
            sa.Column("final_centavos", sa.Integer(), nullable=True),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_nfp_rateio_org_comp", "nfp_rateio", ["organizacao_id", "competencia"])
        op.create_index("ix_nfp_rateio_origem", "nfp_rateio", ["organizacao_id", "origem"])

    if "nfp_batimento_doador" not in tabelas:
        op.create_table(
            "nfp_batimento_doador",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=False),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("id_doacao", sa.String(), nullable=True),
            sa.Column("id_sefaz", sa.String(), nullable=True),
            sa.Column("cpf_doador_cadastrador", sa.String(), nullable=True),
            sa.Column("cnpj_estabelecimento", sa.String(), nullable=True),
            sa.Column("emitente", sa.String(), nullable=True),
            sa.Column("numero_nota", sa.String(), nullable=True),
            sa.Column("data_emissao", sa.String(), nullable=True),
            sa.Column("data_nota", sa.String(), nullable=True),
            sa.Column("ocorrencia", sa.Integer(), nullable=True),
            sa.Column("valor_nota_centavos", sa.Integer(), nullable=True),
            sa.Column("valor_nf_centavos", sa.Integer(), nullable=True),
            sa.Column("creditos_centavos", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_nfp_batimento_org_comp", "nfp_batimento_doador", ["organizacao_id", "competencia"])


def downgrade() -> None:
    for tabela in [
        "nfp_batimento_doador",
        "nfp_rateio",
        "nfp_sefaz_creditos",
        "nfp_doacoes_automaticas",
        "nfp_cnpjs_lojas",
        "nfp_doadores",
    ]:
        op.drop_table(tabela)
