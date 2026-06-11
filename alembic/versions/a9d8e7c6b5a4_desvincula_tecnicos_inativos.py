"""desvincula tecnicos inativos

Revision ID: a9d8e7c6b5a4
Revises: f2c9a7d4e6b1
Create Date: 2026-06-11 13:25:00.000000
"""

from alembic import op


revision = "a9d8e7c6b5a4"
down_revision = "f2c9a7d4e6b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            UPDATE conviventes
            SET tecnico_id = NULL
            WHERE tecnico_id IN (
                SELECT id
                FROM usuarios
                WHERE ativo IS FALSE
            )
            """
        )
        return

    op.execute(
        """
        UPDATE conviventes
        SET tecnico_id = NULL
        WHERE tecnico_id IN (
            SELECT id
            FROM usuarios
            WHERE ativo = 0
        )
        """
    )


def downgrade() -> None:
    # Data cleanup is intentionally irreversible: historical records keep the old user ids.
    pass
