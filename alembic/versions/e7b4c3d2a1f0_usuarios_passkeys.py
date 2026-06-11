"""usuarios passkeys

Revision ID: e7b4c3d2a1f0
Revises: e4f2a9c8b7d1
Create Date: 2026-06-09 21:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b4c3d2a1f0"
down_revision: Union[str, Sequence[str], None] = "e4f2a9c8b7d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "usuarios_passkeys" in inspector.get_table_names():
        return

    op.create_table(
        "usuarios_passkeys",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False),
        sa.Column("organizacao_id", sa.String(), nullable=True),
        sa.Column("credential_id", sa.String(), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", sa.Text(), nullable=True),
        sa.Column("nome_dispositivo", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("ultimo_uso_em", sa.DateTime(), nullable=True),
        sa.Column("revogado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["organizacao_id"], ["organizacoes.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id"),
    )
    op.create_index("ix_usuarios_passkeys_usuario_id", "usuarios_passkeys", ["usuario_id"])
    op.create_index("ix_usuarios_passkeys_instituicao_id", "usuarios_passkeys", ["instituicao_id"])
    op.create_index("ix_usuarios_passkeys_organizacao_id", "usuarios_passkeys", ["organizacao_id"])
    op.create_index("ix_usuarios_passkeys_credential_id", "usuarios_passkeys", ["credential_id"])
    op.create_index("ix_usuarios_passkeys_usuario_ativo", "usuarios_passkeys", ["usuario_id", "ativo"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "usuarios_passkeys" not in inspector.get_table_names():
        return

    op.drop_index("ix_usuarios_passkeys_usuario_ativo", table_name="usuarios_passkeys")
    op.drop_index("ix_usuarios_passkeys_credential_id", table_name="usuarios_passkeys")
    op.drop_index("ix_usuarios_passkeys_organizacao_id", table_name="usuarios_passkeys")
    op.drop_index("ix_usuarios_passkeys_instituicao_id", table_name="usuarios_passkeys")
    op.drop_index("ix_usuarios_passkeys_usuario_id", table_name="usuarios_passkeys")
    op.drop_table("usuarios_passkeys")
