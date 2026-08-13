"""Campos extras da leitura NFP (chave/QR) em nfp_cupons_lidos.

Revision ID: n9o0p1q2r3s4
Revises: k6l7m8n9o0p1
Create Date: 2026-08-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n9o0p1q2r3s4"
down_revision: Union[str, None] = "k6l7m8n9o0p1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOVAS_COLUNAS = (
    ("data_emissao", sa.String()),
    ("uf_ibge", sa.String()),
    ("modelo", sa.String()),
    ("serie", sa.String()),
    ("numero_nf", sa.String()),
    ("tipo_emissao", sa.String()),
    ("valor_centavos", sa.Integer()),
    ("qr_versao", sa.String()),
    ("tp_ambiente", sa.String()),
    ("tp_id_dest", sa.String()),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cupons_lidos" not in set(inspector.get_table_names()):
        return
    existentes = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
    for nome, tipo in NOVAS_COLUNAS:
        if nome not in existentes:
            op.add_column("nfp_cupons_lidos", sa.Column(nome, tipo, nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE nfp_cupons_lidos
            SET
                uf_ibge = CASE WHEN length(chave) = 44 THEN substr(chave, 1, 2) ELSE uf_ibge END,
                modelo = CASE WHEN length(chave) = 44 THEN substr(chave, 21, 2) ELSE modelo END,
                serie = CASE WHEN length(chave) = 44 THEN substr(chave, 23, 3) ELSE serie END,
                numero_nf = CASE WHEN length(chave) = 44 THEN substr(chave, 26, 9) ELSE numero_nf END,
                tipo_emissao = CASE WHEN length(chave) = 44 THEN substr(chave, 35, 1) ELSE tipo_emissao END,
                data_emissao_ref = CASE
                    WHEN (data_emissao_ref IS NULL OR data_emissao_ref = '')
                         AND length(chave) = 44
                    THEN '20' || substr(chave, 3, 2) || '-' || substr(chave, 5, 2)
                    ELSE data_emissao_ref
                END,
                cnpj_emitente = CASE
                    WHEN (cnpj_emitente IS NULL OR cnpj_emitente = '')
                         AND length(chave) = 44
                    THEN substr(chave, 7, 14)
                    ELSE cnpj_emitente
                END
            WHERE length(chave) = 44
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "nfp_cupons_lidos" not in set(inspector.get_table_names()):
        return
    existentes = {c["name"] for c in inspector.get_columns("nfp_cupons_lidos")}
    for nome, _tipo in reversed(NOVAS_COLUNAS):
        if nome in existentes:
            op.drop_column("nfp_cupons_lidos", nome)
