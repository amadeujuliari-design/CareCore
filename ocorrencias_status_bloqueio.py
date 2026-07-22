"""Bloqueio de saída institucional enquanto houver ocorrências abertas."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from convivente_datas_cadastro import STATUS_INATIVOS
from models import OcorrenciaConviventeDB


async def contar_ocorrencias_abertas_convivente(
    db: AsyncSession,
    *,
    convivente_id: str,
    instituicao_id: str,
) -> int:
    total = (
        await db.execute(
            select(func.count(OcorrenciaConviventeDB.id)).where(
                OcorrenciaConviventeDB.convivente_id == convivente_id,
                OcorrenciaConviventeDB.instituicao_id == instituicao_id,
                OcorrenciaConviventeDB.status_resolucao != "Resolvido",
            )
        )
    ).scalar_one()
    return int(total or 0)


async def exigir_sem_ocorrencias_abertas_para_saida_institucional(
    db: AsyncSession,
    *,
    convivente_id: str,
    instituicao_id: str,
    status_antigo: str | None,
    status_novo: str | None,
) -> None:
    """Impede Inativado/Bloqueado/Saída qualificada enquanto houver ocorrência aberta."""
    if status_antigo == status_novo:
        return
    if status_novo not in STATUS_INATIVOS:
        return

    total_abertas = await contar_ocorrencias_abertas_convivente(
        db,
        convivente_id=convivente_id,
        instituicao_id=instituicao_id,
    )
    if total_abertas <= 0:
        return

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f"Existem {total_abertas} ocorrência(s) em aberto para este convivente. "
            "Encerre-as na Central de Ocorrências (parecer técnico) antes de alterar "
            f"o status para {status_novo}."
        ),
    )
