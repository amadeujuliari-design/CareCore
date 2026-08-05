"""Migration: identidade de relatorios na organizacao (sede)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e9a0b1c2d3e4"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUNAS = (
    "relatorio_logo_url",
    "relatorio_nome_exibicao",
    "relatorio_rodape_linha1",
    "relatorio_rodape_linha2",
    "relatorio_telefone",
    "relatorio_email",
    "relatorio_site",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "organizacoes" not in set(inspector.get_table_names()):
        return

    cols = {c["name"] for c in inspector.get_columns("organizacoes")}
    for nome in _COLUNAS:
        if nome not in cols:
            op.add_column("organizacoes", sa.Column(nome, sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "organizacoes" not in set(inspector.get_table_names()):
        return

    cols = {c["name"] for c in inspector.get_columns("organizacoes")}
    for nome in reversed(_COLUNAS):
        if nome in cols:
            op.drop_column("organizacoes", nome)
