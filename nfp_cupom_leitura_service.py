"""Leitura de cupons NFP com checagem SEFAZ em background.

Fluxo:
  1) Extrai chave localmente e grava rapido (status=checando).
  2) Consulta SEFAZ em paralelo (fila com limite de concorrencia).
  3) Atualiza para pendente (elegivel ao robo) ou rejeitado_cpf.
  4) QR que ja indica CPF: rejeitado_cpf na hora, sem HTTP.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import NfpCupomLidoDB
from nfp_cupom_utils import (
    consultar_elegibilidade_cupom,
    extrair_chave_de_leitura,
    montar_url_consulta_sp,
    qr_indica_cpf_destinatario,
)
from time_operacional import agora_operacional_naive

logger = logging.getLogger("carecore.nfp.cupom_leitura")

STATUS_CHECANDO = "checando"
STATUS_PENDENTE = "pendente"
STATUS_REJEITADO_CPF = "rejeitado_cpf"
STATUS_ERRO = "erro"

# Limite de consultas SEFAZ simultaneas (nao saturar a Fazenda / thread pool).
_SEFAZ_SEM = asyncio.Semaphore(4)
_tarefas_agendadas: set[asyncio.Task] = set()


def _meta_chave(chave: str, qr_bruto: str = "") -> dict[str, Optional[str]]:
    url = montar_url_consulta_sp(chave, qr_bruto)
    cnpj = chave[6:20] if len(chave) >= 20 else None
    data_ref = None
    aamm = chave[2:6] if len(chave) >= 6 else ""
    if len(aamm) == 4 and aamm.isdigit():
        data_ref = f"20{aamm[0:2]}-{aamm[2:4]}"
    return {
        "url_consulta": url,
        "cnpj_emitente": cnpj,
        "data_emissao_ref": data_ref,
    }


async def registrar_leitura_rapida(
    db: AsyncSession,
    *,
    organizacao_id: str,
    captador: str,
    bruto: str,
    usuario_id: Optional[str] = None,
) -> dict[str, Any]:
    """Grava a leitura sem bloquear na SEFAZ. Agenda checagem em background."""
    bruto_n = (bruto or "").strip()
    chave = extrair_chave_de_leitura(bruto_n)
    if not chave:
        raise ValueError("Nao foi possivel extrair chave de 44 digitos da leitura.")

    existente = (
        await db.execute(
            select(NfpCupomLidoDB).where(
                NfpCupomLidoDB.organizacao_id == organizacao_id,
                NfpCupomLidoDB.chave == chave,
            )
        )
    ).scalar_one_or_none()
    if existente:
        raise LookupError(existente)

    agora = agora_operacional_naive()
    meta = _meta_chave(chave, bruto_n)
    cpf_no_qr = qr_indica_cpf_destinatario(bruto_n)

    if cpf_no_qr:
        row = NfpCupomLidoDB(
            organizacao_id=organizacao_id,
            chave=chave,
            captador=captador,
            status=STATUS_REJEITADO_CPF,
            consumidor_identificado=True,
            cnpj_emitente=meta["cnpj_emitente"],
            data_emissao_ref=meta["data_emissao_ref"],
            qr_bruto=bruto_n[:4000] or None,
            url_consulta=meta["url_consulta"],
            mensagem="QR indica destinatario com CPF — nao elegivel para doacao manual.",
            lido_por_usuario_id=usuario_id or None,
            lido_em=agora,
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return {
            "ok": True,
            "checagem": "imediata_cpf",
            "cupom": row,
        }

    row = NfpCupomLidoDB(
        organizacao_id=organizacao_id,
        chave=chave,
        captador=captador,
        status=STATUS_CHECANDO,
        consumidor_identificado=None,
        cnpj_emitente=meta["cnpj_emitente"],
        data_emissao_ref=meta["data_emissao_ref"],
        qr_bruto=bruto_n[:4000] or None,
        url_consulta=meta["url_consulta"],
        mensagem="Leitura registrada. Validando consumidor na SEFAZ…",
        lido_por_usuario_id=usuario_id or None,
        lido_em=agora,
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    cupom_id = row.id
    agendar_checagem_sefaz(cupom_id)
    return {
        "ok": True,
        "checagem": "agendada",
        "cupom": row,
    }


def agendar_checagem_sefaz(cupom_id: str) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning("Sem event loop para agendar checagem do cupom %s", cupom_id)
        return

    task = loop.create_task(_worker_checagem_sefaz(cupom_id))
    _tarefas_agendadas.add(task)
    task.add_done_callback(_tarefas_agendadas.discard)


async def _worker_checagem_sefaz(cupom_id: str) -> None:
    async with _SEFAZ_SEM:
        try:
            await _aplicar_checagem_sefaz(cupom_id)
        except Exception:
            logger.exception("Falha na checagem SEFAZ do cupom %s", cupom_id)


async def _aplicar_checagem_sefaz(cupom_id: str) -> None:
    async with AsyncSessionLocal() as db:
        row = await db.get(NfpCupomLidoDB, cupom_id)
        if not row or row.status != STATUS_CHECANDO:
            return

        bruto = (row.qr_bruto or row.chave or "").strip()
        resultado = await asyncio.to_thread(consultar_elegibilidade_cupom, bruto or row.chave)
        agora = agora_operacional_naive()
        row.atualizado_em = agora
        if resultado.url_consulta:
            row.url_consulta = resultado.url_consulta
        if resultado.cnpj_emitente:
            row.cnpj_emitente = resultado.cnpj_emitente
        if resultado.data_emissao:
            row.data_emissao_ref = resultado.data_emissao

        if resultado.consumidor_identificado is True:
            row.status = STATUS_REJEITADO_CPF
            row.consumidor_identificado = True
            row.mensagem = (
                resultado.mensagem
                or "Cupom com CPF do consumidor — nao entra na fila do robo."
            )
        elif resultado.consumidor_identificado is False:
            row.status = STATUS_PENDENTE
            row.consumidor_identificado = False
            row.mensagem = (
                resultado.mensagem
                or "Consumidor nao identificado — elegivel para o robo."
            )
        else:
            # Inconclusivo / falha de rede: libera para o robo (filtro fino la).
            row.status = STATUS_PENDENTE
            row.consumidor_identificado = None
            row.mensagem = (
                (resultado.mensagem or "Validacao SEFAZ inconclusiva.")
                + " Enviado a fila do robo; recusa de CPF sera tratada no envio."
            )[:2000]

        await db.commit()
