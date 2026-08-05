"""Migration: origem_cadastro em nfp_doadores."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_doadores" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("nfp_doadores")}
    if "origem_cadastro" not in cols:
        op.add_column("nfp_doadores", sa.Column("origem_cadastro", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_doadores" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("nfp_doadores")}
    if "origem_cadastro" in cols:
        op.drop_column("nfp_doadores", "origem_cadastro")
