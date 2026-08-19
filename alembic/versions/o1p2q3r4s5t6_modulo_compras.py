"""Modulo Compras: janelas, pedidos, cotacoes, patrimonio e flags SaaS.

Revision ID: o1p2q3r4s5t6
Revises: n9o0p1q2r3s4
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o1p2q3r4s5t6"
down_revision: Union[str, None] = "n9o0p1q2r3s4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(inspector, tabela: str) -> set[str]:
    if tabela not in inspector.get_table_names():
        return set()
    return {coluna["name"] for coluna in inspector.get_columns(tabela)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if "organizacoes" in tabelas and "compras_ativo" not in _colunas(inspector, "organizacoes"):
        op.add_column(
            "organizacoes",
            sa.Column("compras_ativo", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if "usuarios" in tabelas and "compras_modulo_ativo" not in _colunas(inspector, "usuarios"):
        op.add_column(
            "usuarios",
            sa.Column("compras_modulo_ativo", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if "compras_categorias" not in tabelas:
        op.create_table(
            "compras_categorias",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organizacao_id", "nome", name="uq_compras_categoria_org_nome"),
        )
        op.create_index("ix_compras_categoria_org", "compras_categorias", ["organizacao_id"])

    if "compras_fontes_recurso" not in tabelas:
        op.create_table(
            "compras_fontes_recurso",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organizacao_id", "nome", name="uq_compras_fonte_org_nome"),
        )
        op.create_index("ix_compras_fonte_org", "compras_fontes_recurso", ["organizacao_id"])

    if "compras_fornecedores" not in tabelas:
        op.create_table(
            "compras_fornecedores",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("categoria_id", sa.String(), sa.ForeignKey("compras_categorias.id"), nullable=True),
            sa.Column("nome", sa.String(), nullable=False),
            sa.Column("cnpj", sa.String(), nullable=True),
            sa.Column("contato", sa.String(), nullable=True),
            sa.Column("telefone", sa.String(), nullable=True),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("cidade", sa.String(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("bloqueado", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_fornecedor_org", "compras_fornecedores", ["organizacao_id"])
        op.create_index(
            "ix_compras_fornecedor_org_ativo",
            "compras_fornecedores",
            ["organizacao_id", "ativo"],
        )

    if "compras_janelas" not in tabelas:
        op.create_table(
            "compras_janelas",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("data_inicio", sa.Date(), nullable=False),
            sa.Column("data_fim", sa.Date(), nullable=False),
            sa.Column("criado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organizacao_id", "competencia", name="uq_compras_janela_org_comp"),
        )
        op.create_index("ix_compras_janela_org", "compras_janelas", ["organizacao_id"])

    if "compras_janela_liberacoes" not in tabelas:
        op.create_table(
            "compras_janela_liberacoes",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("janela_id", sa.String(), sa.ForeignKey("compras_janelas.id"), nullable=False),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("motivo", sa.Text(), nullable=True),
            sa.Column("liberado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("janela_id", "instituicao_id", name="uq_compras_janela_lib_inst"),
        )
        op.create_index("ix_compras_janela_lib_janela", "compras_janela_liberacoes", ["janela_id"])

    if "compras_pedidos" not in tabelas:
        op.create_table(
            "compras_pedidos",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("tipo", sa.String(), nullable=False, server_default="consumo"),
            sa.Column("competencia", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="rascunho"),
            sa.Column("fonte_recurso_id", sa.String(), sa.ForeignKey("compras_fontes_recurso.id"), nullable=True),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("criado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("submetido_em", sa.DateTime(), nullable=True),
            sa.Column("aprovado_unidade_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("aprovado_unidade_em", sa.DateTime(), nullable=True),
            sa.Column("aprovado_sede_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("aprovado_sede_em", sa.DateTime(), nullable=True),
            sa.Column("enviado_em", sa.DateTime(), nullable=True),
            sa.Column("enviado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("recebido_em", sa.DateTime(), nullable=True),
            sa.Column("recebido_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("recebimento_observacao", sa.Text(), nullable=True),
            sa.Column("recebimento_divergencia", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("cancelado_em", sa.DateTime(), nullable=True),
            sa.Column("cancelado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("motivo_cancelamento", sa.Text(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_pedido_org_status", "compras_pedidos", ["organizacao_id", "status"])
        op.create_index("ix_compras_pedido_instituicao", "compras_pedidos", ["instituicao_id", "competencia"])

    if "compras_pedido_itens" not in tabelas:
        op.create_table(
            "compras_pedido_itens",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=False),
            sa.Column("categoria_id", sa.String(), sa.ForeignKey("compras_categorias.id"), nullable=True),
            sa.Column("descricao", sa.String(), nullable=False),
            sa.Column("quantidade", sa.Float(), nullable=False, server_default="1"),
            sa.Column("unidade_medida", sa.String(), nullable=True),
            sa.Column("marca_preferencial", sa.String(), nullable=True),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("quantidade_recebida", sa.Float(), nullable=True),
            sa.Column("validade_lote", sa.Date(), nullable=True),
        )
        op.create_index("ix_compras_pedido_item_pedido", "compras_pedido_itens", ["pedido_id"])

    if "compras_cotacoes" not in tabelas:
        op.create_table(
            "compras_cotacoes",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=False),
            sa.Column("fornecedor_id", sa.String(), sa.ForeignKey("compras_fornecedores.id"), nullable=True),
            sa.Column("fornecedor_nome", sa.String(), nullable=False),
            sa.Column("valor_centavos", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("escolhida", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("observacao", sa.Text(), nullable=True),
            sa.Column("criado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_compras_cotacao_pedido", "compras_cotacoes", ["pedido_id"])

    if "compras_patrimonio" not in tabelas:
        op.create_table(
            "compras_patrimonio",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("organizacao_id", sa.String(), sa.ForeignKey("organizacoes.id"), nullable=False),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("pedido_id", sa.String(), sa.ForeignKey("compras_pedidos.id"), nullable=True),
            sa.Column("pedido_item_id", sa.String(), sa.ForeignKey("compras_pedido_itens.id"), nullable=True),
            sa.Column("descricao", sa.String(), nullable=False),
            sa.Column("localizacao", sa.String(), nullable=True),
            sa.Column("documento_nf", sa.String(), nullable=True),
            sa.Column("valor_centavos", sa.Integer(), nullable=True),
            sa.Column("origem", sa.String(), nullable=True, server_default="compra"),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_compras_patrimonio_org_inst",
            "compras_patrimonio",
            ["organizacao_id", "instituicao_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    for tabela in (
        "compras_patrimonio",
        "compras_cotacoes",
        "compras_pedido_itens",
        "compras_pedidos",
        "compras_janela_liberacoes",
        "compras_janelas",
        "compras_fornecedores",
        "compras_fontes_recurso",
        "compras_categorias",
    ):
        if tabela in tabelas:
            op.drop_table(tabela)

    inspector = sa.inspect(bind)
    if "compras_modulo_ativo" in _colunas(inspector, "usuarios"):
        op.drop_column("usuarios", "compras_modulo_ativo")
    if "compras_ativo" in _colunas(inspector, "organizacoes"):
        op.drop_column("organizacoes", "compras_ativo")
