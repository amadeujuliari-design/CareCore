"""Regras de datas cadastrais do convivente (inclusão, inativação, nova vinculação)."""
from __future__ import annotations

from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    DocumentoConviventeDB,
    HistoricoConviventeDB,
    LavanderiaRegistroDB,
    OcorrenciaConviventeDB,
    RegistroPIADB,
    RegistroRotinaDB,
)

STATUS_INATIVOS = frozenset({"Inativado", "Bloqueado", "Saída qualificada"})
STATUS_VINCULACAO_ATIVA = frozenset({"Ativo", "Em acolhimento"})


def _extrair_data(valor) -> date | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return None


def normalizar_prontuario_saude(valor: str | None) -> str | None:
    texto = (valor or "").strip()
    return texto or None


def preparar_datas_convivente_criacao(dados: dict, hoje: date) -> None:
    if not dados.get("data_inclusao"):
        dados["data_inclusao"] = hoje

    if "prontuario_saude" in dados:
        dados["prontuario_saude"] = normalizar_prontuario_saude(dados.get("prontuario_saude"))

    status = dados.get("status", "Ativo")
    if status in STATUS_INATIVOS and not dados.get("data_inativacao"):
        dados["data_inativacao"] = hoje


def aplicar_datas_convivente_payload(
    dados: dict,
    status_antigo: str | None,
    novo_status: str,
    hoje: date,
    campos_enviados: set[str],
) -> None:
    if novo_status != status_antigo:
        if novo_status in STATUS_INATIVOS and "data_inativacao" not in campos_enviados:
            dados["data_inativacao"] = hoje
        if (
            status_antigo in STATUS_INATIVOS
            and novo_status in STATUS_VINCULACAO_ATIVA
            and "data_nova_vinculacao" not in campos_enviados
        ):
            dados["data_nova_vinculacao"] = hoje

    if "prontuario_saude" in dados:
        dados["prontuario_saude"] = normalizar_prontuario_saude(dados.get("prontuario_saude"))


def aplicar_datas_convivente_objeto(
    convivente,
    status_antigo: str,
    novo_status: str,
    hoje: date,
) -> None:
    if novo_status == status_antigo:
        return
    if novo_status in STATUS_INATIVOS:
        convivente.data_inativacao = hoje
    if status_antigo in STATUS_INATIVOS and novo_status in STATUS_VINCULACAO_ATIVA:
        convivente.data_nova_vinculacao = hoje


async def obter_data_primeira_interacao(
    db: AsyncSession,
    convivente_id: str,
) -> date | None:
    candidatos: list[date] = []

    consultas = [
        (RegistroRotinaDB, RegistroRotinaDB.data_registro),
        (OcorrenciaConviventeDB, OcorrenciaConviventeDB.data_ocorrencia),
        (RegistroPIADB, RegistroPIADB.data_registro),
        (DocumentoConviventeDB, DocumentoConviventeDB.data_upload),
        (LavanderiaRegistroDB, LavanderiaRegistroDB.entregue_em),
    ]

    for modelo, coluna in consultas:
        minimo = (
            await db.execute(
                select(func.min(coluna)).where(modelo.convivente_id == convivente_id)
            )
        ).scalar()
        data_minima = _extrair_data(minimo)
        if data_minima:
            candidatos.append(data_minima)

    min_historico = (
        await db.execute(
            select(func.min(HistoricoConviventeDB.data_origem)).where(
                HistoricoConviventeDB.convivente_id == convivente_id
            )
        )
    ).scalar()
    data_historico = _extrair_data(min_historico)
    if data_historico:
        candidatos.append(data_historico)

    return min(candidatos) if candidatos else None


async def validar_data_inclusao_convivente(
    db: AsyncSession,
    convivente_id: str | None,
    data_inclusao: date | None,
) -> None:
    if not convivente_id or not data_inclusao:
        return

    primeira_interacao = await obter_data_primeira_interacao(db, convivente_id)
    if primeira_interacao and data_inclusao > primeira_interacao:
        raise HTTPException(
            status_code=400,
            detail=(
                "A data de inclusão não pode ser posterior à primeira interação "
                f"registrada no sistema ({primeira_interacao.strftime('%d/%m/%Y')})."
            ),
        )
