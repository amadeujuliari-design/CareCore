"""ficha PIA convivente — campos, listas e projeto de vida

Revision ID: e8f1a2b3c4d5
Revises: d3e4f5a6b7c8
Create Date: 2026-06-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f1a2b3c4d5"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conv_cols = [
        ("cor_raca", sa.String()),
        ("possui_religiao", sa.Boolean()),
        ("religiao_qual", sa.String()),
        ("relacao_familiar_situacao", sa.String()),
        ("relacao_familiar_outra", sa.Text()),
        ("data_inicio_pia", sa.Date()),
        ("em_sao_paulo_desde", sa.Date()),
        ("alfabetizado", sa.Boolean()),
        ("ef_concluido", sa.Boolean()),
        ("ef_incompleto", sa.Boolean()),
        ("ef_incompleto_serie", sa.String()),
        ("em_concluido", sa.Boolean()),
        ("em_incompleto", sa.Boolean()),
        ("em_incompleto_serie", sa.String()),
        ("es_concluido", sa.Boolean()),
        ("es_incompleto", sa.Boolean()),
        ("es_incompleto_periodo", sa.String()),
        ("estuda_atualmente", sa.Boolean()),
        ("estuda_curso", sa.String()),
        ("interesse_eja", sa.Boolean()),
        ("profissao", sa.String()),
        ("situacoes_trabalho", sa.Text()),
        ("trabalho_nao_remunerada_qual", sa.Text()),
        ("trabalho_cursos_participou", sa.Boolean()),
        ("trabalho_cursos_quais", sa.Text()),
        ("trabalho_certificados", sa.Boolean()),
        ("trabalho_certificados_quais", sa.Text()),
        ("trabalho_pretende_curso", sa.Boolean()),
        ("trabalho_pretende_curso_quais", sa.Text()),
        ("beneficios_pia", sa.Text()),
        ("rua_desde", sa.String()),
        ("rua_relato", sa.Text()),
        ("saude_hist_familia", sa.Boolean()),
        ("saude_hist_familia_qual", sa.Text()),
        ("saude_problema", sa.Boolean()),
        ("saude_problema_qual", sa.Text()),
        ("saude_laudo", sa.Boolean()),
        ("saude_cid", sa.String()),
        ("saude_outro_equipamento", sa.Boolean()),
        ("saude_outro_equipamento_onde", sa.String()),
        ("pendencia_judiciaria", sa.Boolean()),
        ("pendencia_judiciaria_qual", sa.Text()),
        ("pendencia_eleitoral", sa.Boolean()),
        ("pendencia_eleitoral_qual", sa.Text()),
        ("egresso_artigo_motivo", sa.Text()),
        ("egresso_ano", sa.String()),
    ]
    for nome, tipo in conv_cols:
        op.add_column("conviventes", sa.Column(nome, tipo, nullable=True))

    pia_cols = [
        ("expectativas_servico", sa.Text()),
        ("expectativas_vida_projetos", sa.Text()),
        ("destino_siat_iii", sa.Boolean()),
        ("destino_moradia_autonoma", sa.Boolean()),
        ("destino_retorno_familiar", sa.Boolean()),
        ("destino_explicacao", sa.Text()),
        ("dificuldades_planos", sa.Text()),
    ]
    for nome, tipo in pia_cols:
        op.add_column("registros_pia", sa.Column(nome, tipo, nullable=True))

    op.create_table(
        "convivente_familiares",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("parentesco", sa.String(), nullable=False),
        sa.Column("parentesco_outros", sa.String(), nullable=True),
        sa.Column("nome", sa.String(), nullable=True),
        sa.Column("idade", sa.Integer(), nullable=True),
        sa.Column("endereco", sa.Text(), nullable=True),
        sa.Column("telefone", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "convivente_documentos_civis",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("tipo_outros", sa.String(), nullable=True),
        sa.Column("numero", sa.String(), nullable=True),
        sa.Column("orientacoes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "convivente_substancias",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("desde_quando", sa.String(), nullable=True),
        sa.Column("quantidade", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "convivente_medicamentos",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("tempo_uso", sa.String(), nullable=True),
        sa.Column("modo_uso", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "convivente_internacoes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("onde", sa.String(), nullable=True),
        sa.Column("periodo", sa.String(), nullable=True),
        sa.Column("quem_encaminhou", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "convivente_equipamentos_anteriores",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instituicao_id", sa.String(), nullable=False, index=True),
        sa.Column("convivente_id", sa.String(), nullable=False, index=True),
        sa.Column("origem_encaminhamento_id", sa.String(), nullable=True),
        sa.Column("descricao_outros", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["convivente_id"], ["conviventes.id"]),
        sa.ForeignKeyConstraint(["instituicao_id"], ["instituicoes.id"]),
        sa.ForeignKeyConstraint(["origem_encaminhamento_id"], ["origens_encaminhamento.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("convivente_equipamentos_anteriores")
    op.drop_table("convivente_internacoes")
    op.drop_table("convivente_medicamentos")
    op.drop_table("convivente_substancias")
    op.drop_table("convivente_documentos_civis")
    op.drop_table("convivente_familiares")

    for nome, _ in reversed([
        ("dificuldades_planos", sa.Text()),
        ("destino_explicacao", sa.Text()),
        ("destino_retorno_familiar", sa.Boolean()),
        ("destino_moradia_autonoma", sa.Boolean()),
        ("destino_siat_iii", sa.Boolean()),
        ("expectativas_vida_projetos", sa.Text()),
        ("expectativas_servico", sa.Text()),
    ]):
        op.drop_column("registros_pia", nome)

    for nome, _ in reversed([
        ("egresso_ano", sa.String()),
        ("egresso_artigo_motivo", sa.Text()),
        ("pendencia_eleitoral_qual", sa.Text()),
        ("pendencia_eleitoral", sa.Boolean()),
        ("pendencia_judiciaria_qual", sa.Text()),
        ("pendencia_judiciaria", sa.Boolean()),
        ("saude_outro_equipamento_onde", sa.String()),
        ("saude_outro_equipamento", sa.Boolean()),
        ("saude_cid", sa.String()),
        ("saude_laudo", sa.Boolean()),
        ("saude_problema_qual", sa.Text()),
        ("saude_problema", sa.Boolean()),
        ("saude_hist_familia_qual", sa.Text()),
        ("saude_hist_familia", sa.Boolean()),
        ("rua_relato", sa.Text()),
        ("rua_desde", sa.String()),
        ("beneficios_pia", sa.Text()),
        ("trabalho_pretende_curso_quais", sa.Text()),
        ("trabalho_pretende_curso", sa.Boolean()),
        ("trabalho_certificados_quais", sa.Text()),
        ("trabalho_certificados", sa.Boolean()),
        ("trabalho_cursos_quais", sa.Text()),
        ("trabalho_cursos_participou", sa.Boolean()),
        ("trabalho_nao_remunerada_qual", sa.Text()),
        ("situacoes_trabalho", sa.Text()),
        ("profissao", sa.String()),
        ("interesse_eja", sa.Boolean()),
        ("estuda_curso", sa.String()),
        ("estuda_atualmente", sa.Boolean()),
        ("es_incompleto_periodo", sa.String()),
        ("es_incompleto", sa.Boolean()),
        ("es_concluido", sa.Boolean()),
        ("em_incompleto_serie", sa.String()),
        ("em_incompleto", sa.Boolean()),
        ("em_concluido", sa.Boolean()),
        ("ef_incompleto_serie", sa.String()),
        ("ef_incompleto", sa.Boolean()),
        ("ef_concluido", sa.Boolean()),
        ("alfabetizado", sa.Boolean()),
        ("em_sao_paulo_desde", sa.Date()),
        ("data_inicio_pia", sa.Date()),
        ("relacao_familiar_outra", sa.Text()),
        ("relacao_familiar_situacao", sa.String()),
        ("religiao_qual", sa.String()),
        ("possui_religiao", sa.Boolean()),
        ("cor_raca", sa.String()),
    ]):
        op.drop_column("conviventes", nome)
