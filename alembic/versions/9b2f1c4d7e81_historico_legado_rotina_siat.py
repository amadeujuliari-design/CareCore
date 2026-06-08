"""historico legado rotina siat

Revision ID: 9b2f1c4d7e81
Revises: 4ec43e6c7a15
Create Date: 2026-06-05 20:24:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b2f1c4d7e81'
down_revision: Union[str, Sequence[str], None] = '4ec43e6c7a15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'historico_legado_rotina_siat',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('instituicao_id', sa.String(), nullable=False),
        sa.Column('convivente_id', sa.String(), nullable=True),
        sa.Column('origem_arquivo', sa.String(), nullable=False),
        sa.Column('linha_origem', sa.Integer(), nullable=True),
        sa.Column('id_as_atendimento_serv_legado', sa.String(), nullable=False),
        sa.Column('id_as_atendimento_legado', sa.String(), nullable=True),
        sa.Column('id_cr_clientes_legado', sa.String(), nullable=True),
        sa.Column('numero_sisa', sa.String(), nullable=True),
        sa.Column('numero_institucional_legado', sa.String(), nullable=True),
        sa.Column('nome_convivente', sa.String(), nullable=True),
        sa.Column('data_nascimento', sa.Date(), nullable=True),
        sa.Column('nome_mae', sa.String(), nullable=True),
        sa.Column('data_servico', sa.Date(), nullable=False),
        sa.Column('servico_prestado', sa.String(), nullable=True),
        sa.Column('id_servico_prestado_legado', sa.String(), nullable=True),
        sa.Column('atividade', sa.String(), nullable=True),
        sa.Column('id_atividade_legado', sa.String(), nullable=True),
        sa.Column('quarto', sa.String(), nullable=True),
        sa.Column('cama', sa.String(), nullable=True),
        sa.Column('periodo_acolhimento', sa.String(), nullable=True),
        sa.Column('data_entrada', sa.Date(), nullable=True),
        sa.Column('data_saida', sa.Date(), nullable=True),
        sa.Column('motivo_saida', sa.String(), nullable=True),
        sa.Column('gestante', sa.Boolean(), nullable=True),
        sa.Column('gestante_com_pre_natal', sa.Boolean(), nullable=True),
        sa.Column('auditoria_datahora', sa.DateTime(), nullable=True),
        sa.Column('usuario_origem', sa.String(), nullable=True),
        sa.Column('chave_natural_convivente', sa.String(), nullable=True),
        sa.Column('confianca_vinculo', sa.String(), nullable=True),
        sa.Column('status_revisao', sa.String(), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('importado_em', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['convivente_id'], ['conviventes.id']),
        sa.ForeignKeyConstraint(['instituicao_id'], ['instituicoes.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id_as_atendimento_serv_legado', name='uq_rotina_siat_atendimento_serv_legado'),
    )

    op.create_index('ix_rotina_siat_instituicao_data', 'historico_legado_rotina_siat', ['instituicao_id', 'data_servico'])
    op.create_index('ix_rotina_siat_instituicao_convivente_data', 'historico_legado_rotina_siat', ['instituicao_id', 'convivente_id', 'data_servico'])
    op.create_index('ix_rotina_siat_instituicao_sisa_data', 'historico_legado_rotina_siat', ['instituicao_id', 'numero_sisa', 'data_servico'])
    op.create_index('ix_rotina_siat_instituicao_servico_data', 'historico_legado_rotina_siat', ['instituicao_id', 'servico_prestado', 'data_servico'])
    op.create_index('ix_rotina_siat_instituicao_quarto_cama', 'historico_legado_rotina_siat', ['instituicao_id', 'quarto', 'cama'])
    op.create_index('ix_rotina_siat_instituicao_status', 'historico_legado_rotina_siat', ['instituicao_id', 'status_revisao'])
    op.create_index('ix_rotina_siat_legado_atendimento', 'historico_legado_rotina_siat', ['id_as_atendimento_legado'])
    op.create_index('ix_rotina_siat_nome_convivente', 'historico_legado_rotina_siat', ['instituicao_id', 'nome_convivente'])
    op.create_index('ix_rotina_siat_usuario_origem', 'historico_legado_rotina_siat', ['instituicao_id', 'usuario_origem'])


def downgrade() -> None:
    op.drop_index('ix_rotina_siat_usuario_origem', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_nome_convivente', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_legado_atendimento', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_status', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_quarto_cama', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_servico_data', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_sisa_data', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_convivente_data', table_name='historico_legado_rotina_siat')
    op.drop_index('ix_rotina_siat_instituicao_data', table_name='historico_legado_rotina_siat')
    op.drop_table('historico_legado_rotina_siat')
