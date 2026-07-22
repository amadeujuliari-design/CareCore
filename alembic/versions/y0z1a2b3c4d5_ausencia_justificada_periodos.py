"""Periodos historicos de ausencia justificada

Revision ID: y0z1a2b3c4d5
Revises: x9y0z1a2b3c4
Create Date: 2026-07-22
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "y0z1a2b3c4d5"
down_revision: Union[str, None] = "x9y0z1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_tabela(inspector, nome: str) -> bool:
    return nome in inspector.get_table_names()


def _as_date(valor):
    if valor is None:
        return None
    if hasattr(valor, "date") and not isinstance(valor, str):
        try:
            return valor.date()
        except Exception:
            pass
    texto = str(valor).strip()
    if not texto:
        return None
    return datetime.fromisoformat(texto.replace("Z", "+00:00")[:19]).date()


def _backfill_periodos_de_ocorrencias(bind) -> None:
    """Reconstroi intervalos AJ a partir das mudancas de status institucionais."""
    rows = bind.execute(
        sa.text(
            """
            SELECT o.instituicao_id, o.convivente_id, o.motivo, o.data_ocorrencia
            FROM ocorrencias_conviventes o
            WHERE o.tipo_ocorrencia LIKE :tipo
              AND (
                o.motivo LIKE :motivo_aj
                OR o.motivo LIKE :motivo_aj_ascii
              )
            ORDER BY o.convivente_id ASC, o.data_ocorrencia ASC
            """
        ),
        {
            "tipo": "%Status%",
            "motivo_aj": "%Aus_ncia justificada%",
            "motivo_aj_ascii": "%Ausencia justificada%",
        },
    ).fetchall()

    abertos: dict[str, tuple[str, object]] = {}
    inseridos: set[tuple[str, str, object, object]] = set()

    for instituicao_id, convivente_id, motivo, data_ocorrencia in rows:
        motivo_txt = str(motivo or "")
        motivo_norm = (
            motivo_txt.replace("ê", "e")
            .replace("é", "e")
            .replace("á", "a")
            .replace("ã", "a")
            .lower()
        )
        data_ref = _as_date(data_ocorrencia)
        if not data_ref:
            continue

        entra = "para ausencia justificada" in motivo_norm
        sai = "ausencia justificada para" in motivo_norm

        if entra and not sai:
            abertos[convivente_id] = (instituicao_id, data_ref)
            continue

        if sai:
            inicio = None
            if convivente_id in abertos:
                instituicao_id, inicio = abertos.pop(convivente_id)
            fim = data_ref
            if inicio is None:
                inicio = fim
            if inicio > fim:
                inicio = fim
            chave = (instituicao_id, convivente_id, inicio, fim)
            if chave in inseridos:
                continue
            inseridos.add(chave)
            bind.execute(
                sa.text(
                    """
                    INSERT INTO ausencias_justificadas_periodos
                    (id, instituicao_id, convivente_id, usuario_id, data_inicio, data_fim, origem_encerramento, criado_em)
                    VALUES
                    (:id, :instituicao_id, :convivente_id, NULL, :data_inicio, :data_fim, :origem, :criado_em)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "instituicao_id": instituicao_id,
                    "convivente_id": convivente_id,
                    "data_inicio": inicio,
                    "data_fim": fim,
                    "origem": "backfill_ocorrencia_status",
                    "criado_em": datetime.utcnow(),
                },
            )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _tem_tabela(inspector, "ausencias_justificadas_periodos"):
        op.create_table(
            "ausencias_justificadas_periodos",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("instituicao_id", sa.String(), sa.ForeignKey("instituicoes.id"), nullable=False),
            sa.Column("convivente_id", sa.String(), sa.ForeignKey("conviventes.id"), nullable=False),
            sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("data_inicio", sa.Date(), nullable=False),
            sa.Column("data_fim", sa.Date(), nullable=False),
            sa.Column("origem_encerramento", sa.String(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_aus_just_per_instituicao_id",
            "ausencias_justificadas_periodos",
            ["instituicao_id"],
        )
        op.create_index(
            "ix_aus_just_per_convivente_id",
            "ausencias_justificadas_periodos",
            ["convivente_id"],
        )
        op.create_index(
            "ix_aus_just_per_intervalo",
            "ausencias_justificadas_periodos",
            ["data_inicio", "data_fim"],
        )
        op.create_index(
            "ux_aus_just_per_convivente_intervalo",
            "ausencias_justificadas_periodos",
            ["instituicao_id", "convivente_id", "data_inicio", "data_fim"],
            unique=True,
        )

    if _tem_tabela(inspector, "ocorrencias_conviventes"):
        _backfill_periodos_de_ocorrencias(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _tem_tabela(inspector, "ausencias_justificadas_periodos"):
        op.drop_index(
            "ux_aus_just_per_convivente_intervalo",
            table_name="ausencias_justificadas_periodos",
        )
        op.drop_index("ix_aus_just_per_intervalo", table_name="ausencias_justificadas_periodos")
        op.drop_index("ix_aus_just_per_convivente_id", table_name="ausencias_justificadas_periodos")
        op.drop_index("ix_aus_just_per_instituicao_id", table_name="ausencias_justificadas_periodos")
        op.drop_table("ausencias_justificadas_periodos")
