"""Leitura de cupons NFP com checagem SEFAZ em background.

Fluxo:
  1) Extrai chave localmente e grava rapido (status=checando).
  2) Chave estruturalmente invalida (modelo/mes/DV): erro — fora da fila.
  3) Fora do prazo NFP (janela de 2 meses ate dia 20, com folga de 1 dia): rejeitado_prazo.
  4) Consulta SEFAZ em paralelo (fila com limite de concorrencia).
  5) Atualiza para pendente (elegivel ao robo) ou rejeitado_cpf.
  6) QR que ja indica CPF: rejeitado_cpf na hora, sem HTTP.
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
    cupom_fora_prazo_leitura,
    extrair_chave_de_leitura,
    mensagem_chave_invalida,
    mensagem_rejeicao_prazo,
    parsear_leitura_cupom,
    qr_indica_cpf_destinatario,
    validar_chave_acesso_nfe,
)
from time_operacional import agora_operacional_naive

logger = logging.getLogger("carecore.nfp.cupom_leitura")

STATUS_CHECANDO = "checando"
STATUS_PENDENTE = "pendente"
STATUS_REJEITADO_CPF = "rejeitado_cpf"
STATUS_REJEITADO_PRAZO = "rejeitado_prazo"
STATUS_ERRO = "erro"

# Limite de consultas SEFAZ simultaneas (nao saturar a Fazenda / thread pool).
_SEFAZ_SEM = asyncio.Semaphore(4)
_tarefas_agendadas: set[asyncio.Task] = set()


CAMPOS_META_LEITURA = (
    "cnpj_emitente",
    "data_emissao_ref",
    "data_emissao",
    "uf_ibge",
    "modelo",
    "serie",
    "numero_nf",
    "tipo_emissao",
    "valor_centavos",
    "qr_versao",
    "tp_ambiente",
    "tp_id_dest",
    "url_consulta",
)


def _meta_leitura(chave: str, qr_bruto: str = "") -> dict[str, object]:
    return parsear_leitura_cupom(qr_bruto or chave, chave)


def _aplicar_meta(row: NfpCupomLidoDB, meta: dict[str, object]) -> None:
    for campo in CAMPOS_META_LEITURA:
        valor = meta.get(campo)
        if valor is None or valor == "":
            continue
        setattr(row, campo, valor)


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
    meta = _meta_leitura(chave, bruto_n)
    hoje = agora.date()
    data_ref = str(meta["data_emissao_ref"]) if meta.get("data_emissao_ref") else None

    def _base_row(**kwargs):
        row = NfpCupomLidoDB(
            organizacao_id=organizacao_id,
            chave=chave,
            captador=captador,
            qr_bruto=bruto_n[:4000] or None,
            lido_por_usuario_id=usuario_id or None,
            lido_em=agora,
            criado_em=agora,
            atualizado_em=agora,
            **kwargs,
        )
        _aplicar_meta(row, meta)
        return row

    ok_chave, motivo_chave = validar_chave_acesso_nfe(chave)
    if not ok_chave:
        row = _base_row(
            status=STATUS_ERRO,
            consumidor_identificado=None,
            mensagem=mensagem_chave_invalida(motivo_chave),
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return {
            "ok": True,
            "checagem": "imediata_chave_invalida",
            "cupom": row,
        }

    # Prazo antes de CPF: cupom vencido nao entra na fila (folga 1 dia vs SEFAZ).
    if cupom_fora_prazo_leitura(data_ref, hoje=hoje):
        row = _base_row(
            status=STATUS_REJEITADO_PRAZO,
            consumidor_identificado=None,
            mensagem=mensagem_rejeicao_prazo(data_ref),
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return {
            "ok": True,
            "checagem": "imediata_prazo",
            "cupom": row,
        }

    cpf_no_qr = qr_indica_cpf_destinatario(bruto_n)

    if cpf_no_qr:
        row = _base_row(
            status=STATUS_REJEITADO_CPF,
            consumidor_identificado=True,
            mensagem="QR indica destinatario com CPF — nao elegivel para doacao manual.",
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return {
            "ok": True,
            "checagem": "imediata_cpf",
            "cupom": row,
        }

    row = _base_row(
        status=STATUS_CHECANDO,
        consumidor_identificado=None,
        mensagem="Leitura registrada. Validando consumidor na SEFAZ…",
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
        _aplicar_meta(
            row,
            {
                "url_consulta": resultado.url_consulta,
                "cnpj_emitente": resultado.cnpj_emitente,
                "data_emissao_ref": resultado.data_emissao_ref,
                "data_emissao": resultado.data_emissao,
                "uf_ibge": resultado.uf_ibge,
                "modelo": resultado.modelo,
                "serie": resultado.serie,
                "numero_nf": resultado.numero_nf,
                "tipo_emissao": resultado.tipo_emissao,
                "valor_centavos": resultado.valor_centavos,
                "qr_versao": resultado.qr_versao,
                "tp_ambiente": resultado.tp_ambiente,
                "tp_id_dest": resultado.tp_id_dest,
            },
        )
        # data_emissao AAAA-MM-DD nao substitui a ref AAAA-MM usada no prazo.
        if resultado.data_emissao and len(resultado.data_emissao) >= 7 and not row.data_emissao_ref:
            row.data_emissao_ref = resultado.data_emissao[:7]

        # Revalida prazo apos meta da SEFAZ/chave (folga 1 dia).
        if cupom_fora_prazo_leitura(row.data_emissao_ref, hoje=agora.date()):
            row.status = STATUS_REJEITADO_PRAZO
            row.mensagem = mensagem_rejeicao_prazo(row.data_emissao_ref)
            await db.commit()
            return

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
