"""Renomeia perfis ADM para nomenclatura NFP/Compras mais clara.

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-08-17
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p2q3r4s5t6u7"
down_revision: Union[str, None] = "o1p2q3r4s5t6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Global NFP' "
        "WHERE perfil_acesso = 'ADM Global'"
    )
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Produção NFP' "
        "WHERE perfil_acesso = 'ADM Produção'"
    )
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Global Compras' "
        "WHERE perfil_acesso = 'ADM Compras'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Global' "
        "WHERE perfil_acesso = 'ADM Global NFP'"
    )
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Produção' "
        "WHERE perfil_acesso = 'ADM Produção NFP'"
    )
    op.execute(
        "UPDATE usuarios SET perfil_acesso = 'ADM Compras' "
        "WHERE perfil_acesso = 'ADM Global Compras'"
    )
