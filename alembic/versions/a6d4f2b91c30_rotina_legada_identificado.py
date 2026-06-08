"""rotina legada identificado

Revision ID: a6d4f2b91c30
Revises: 9b2f1c4d7e81
Create Date: 2026-06-05 21:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a6d4f2b91c30'
down_revision: Union[str, Sequence[str], None] = '9b2f1c4d7e81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'historico_legado_rotina_siat',
        sa.Column('identificado', sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE historico_legado_rotina_siat
        SET identificado = 1
        WHERE convivente_id IS NOT NULL
           OR (nome_convivente IS NOT NULL AND TRIM(nome_convivente) <> '')
           OR (numero_sisa IS NOT NULL AND TRIM(numero_sisa) <> '')
        """
    )
    op.create_index(
        'ix_rotina_siat_instituicao_identificado_data',
        'historico_legado_rotina_siat',
        ['instituicao_id', 'identificado', 'data_servico'],
    )


def downgrade() -> None:
    op.drop_index('ix_rotina_siat_instituicao_identificado_data', table_name='historico_legado_rotina_siat')
    op.drop_column('historico_legado_rotina_siat', 'identificado')
