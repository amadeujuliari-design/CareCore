"""suporte chamados

Revision ID: f2c9a7d4e6b1
Revises: e7b4c3d2a1f0
Create Date: 2026-06-11 00:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2c9a7d4e6b1"
down_revision: Union[str, Sequence[str], None] = "e7b4c3d2a1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = inspector.get_table_names()

    if "suporte_chamados" not in tabelas:
        op.create_table(
            "suporte_chamados",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("numero_ticket", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("organizacao_id", sa.String(), nullable=True),
            sa.Column("usuario_id", sa.String(), nullable=False),
            sa.Column("modulo", sa.String(), nullable=False),
            sa.Column("tela", sa.String(), nullable=False),
            sa.Column("tipo_problema", sa.String(), nullable=False),
            sa.Column("caminho_sistema", sa.String(), nullable=False),
            sa.Column("url_origem", sa.Text(), nullable=True),
            sa.Column("prioridade", sa.String(), nullable=False, server_default="normal"),
            sa.Column("status", sa.String(), nullable=False, server_default="Aberto"),
            sa.Column("assunto", sa.String(), nullable=False),
            sa.Column("relato", sa.Text(), nullable=False),
            sa.Column("email_notificacao_enviado", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("email_notificacao_erro", sa.Text(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.Column("resolvido_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("numero_ticket", name="uq_suporte_chamados_numero_ticket"),
        )
        op.create_index("ix_suporte_chamados_numero_ticket", "suporte_chamados", ["numero_ticket"])
        op.create_index("ix_suporte_chamados_instituicao_id", "suporte_chamados", ["instituicao_id"])
        op.create_index("ix_suporte_chamados_organizacao_id", "suporte_chamados", ["organizacao_id"])
        op.create_index("ix_suporte_chamados_usuario_id", "suporte_chamados", ["usuario_id"])
        op.create_index("ix_suporte_chamados_status", "suporte_chamados", ["status"])
        op.create_index("ix_suporte_chamados_criado_em", "suporte_chamados", ["criado_em"])
        op.create_index("ix_suporte_chamados_instituicao_status", "suporte_chamados", ["instituicao_id", "status"])
        op.create_index("ix_suporte_chamados_instituicao_criado", "suporte_chamados", ["instituicao_id", "criado_em"])
        op.create_index("ix_suporte_chamados_usuario_criado", "suporte_chamados", ["usuario_id", "criado_em"])

    if "suporte_chamados_mensagens" not in tabelas:
        op.create_table(
            "suporte_chamados_mensagens",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("chamado_id", sa.String(), nullable=False),
            sa.Column("instituicao_id", sa.String(), nullable=False),
            sa.Column("usuario_id", sa.String(), nullable=True),
            sa.Column("autor_nome", sa.String(), nullable=False),
            sa.Column("autor_tipo", sa.String(), nullable=False, server_default="usuario"),
            sa.Column("mensagem", sa.Text(), nullable=False),
            sa.Column("publico", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["chamado_id"], ["suporte_chamados.id"]),
            sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_suporte_chamados_mensagens_chamado_id", "suporte_chamados_mensagens", ["chamado_id"])
        op.create_index("ix_suporte_chamados_mensagens_instituicao_id", "suporte_chamados_mensagens", ["instituicao_id"])
        op.create_index("ix_suporte_chamados_mensagens_usuario_id", "suporte_chamados_mensagens", ["usuario_id"])
        op.create_index("ix_suporte_chamados_mensagens_criado_em", "suporte_chamados_mensagens", ["criado_em"])
        op.create_index("ix_suporte_mensagens_chamado_criado", "suporte_chamados_mensagens", ["chamado_id", "criado_em"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = inspector.get_table_names()

    if "suporte_chamados_mensagens" in tabelas:
        op.drop_index("ix_suporte_mensagens_chamado_criado", table_name="suporte_chamados_mensagens")
        op.drop_index("ix_suporte_chamados_mensagens_criado_em", table_name="suporte_chamados_mensagens")
        op.drop_index("ix_suporte_chamados_mensagens_usuario_id", table_name="suporte_chamados_mensagens")
        op.drop_index("ix_suporte_chamados_mensagens_instituicao_id", table_name="suporte_chamados_mensagens")
        op.drop_index("ix_suporte_chamados_mensagens_chamado_id", table_name="suporte_chamados_mensagens")
        op.drop_table("suporte_chamados_mensagens")

    if "suporte_chamados" in tabelas:
        op.drop_index("ix_suporte_chamados_usuario_criado", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_instituicao_criado", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_instituicao_status", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_criado_em", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_status", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_usuario_id", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_organizacao_id", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_instituicao_id", table_name="suporte_chamados")
        op.drop_index("ix_suporte_chamados_numero_ticket", table_name="suporte_chamados")
        op.drop_table("suporte_chamados")
