"""NFP cupons: metadados SEFAZ capturados pelo robo."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l4m5n6o7p8q9"
down_revision: Union[str, None] = "k3l4m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUNAS = (
    ("numero_nota_sefaz", sa.String()),
    ("valor_sefaz_centavos", sa.Integer()),
    ("cnpj_sefaz", sa.String()),
    ("data_nota_sefaz", sa.String()),
    ("tipo_retorno_sefaz", sa.String()),
    ("sefaz_registrado_em", sa.DateTime()),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cupons_lidos" not in inspector.get_table_names():
        return
    existentes = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
    for nome, tipo in _COLUNAS:
        if nome in existentes:
            continue
        op.add_column("nfp_cupons_lidos", sa.Column(nome, tipo, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cupons_lidos" not in inspector.get_table_names():
        return
    existentes = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
    for nome, _ in reversed(_COLUNAS):
        if nome in existentes:
            op.drop_column("nfp_cupons_lidos", nome)
