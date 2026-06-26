"""Validade e bloqueio de carteirinha provisória (quarto rotativo)."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import LeitoDB, QuartoDB
from time_operacional import agora_operacional_naive

VALIDADE_CARTEIRINHA_PROVISORIA_DIAS = 7
AVISO_CARTEIRINHA_PROVISORIA_DIAS = 5
TOLERANCIA_CARTEIRINHA_PROVISORIA_DIAS = (
    VALIDADE_CARTEIRINHA_PROVISORIA_DIAS - AVISO_CARTEIRINHA_PROVISORIA_DIAS
)


def _formatar_restante_operacional(delta: timedelta) -> str:
    horas_restantes = max(0, int(delta.total_seconds() // 3600))
    dias_restantes = max(0, delta.days)
    if dias_restantes > 0:
        return f"{dias_restantes} dia(s) e {horas_restantes % 24}h"
    return f"{horas_restantes}h"


def data_primeira_vinculacao_convivente(data_inclusao, data_entrada=None):
    return data_inclusao or data_entrada


async def obter_quarto_rotativo_do_leito(
    db: AsyncSession,
    leito_id: str | None,
    instituicao_id: str,
) -> QuartoDB | None:
    if not leito_id:
        return None

    return (
        await db.execute(
            select(QuartoDB)
            .join(LeitoDB, LeitoDB.quarto_id == QuartoDB.id)
            .where(
                LeitoDB.id == leito_id,
                QuartoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()


def convivente_em_carteirinha_provisoria(convivente, quarto: QuartoDB | None) -> bool:
    return bool(
        convivente
        and convivente.leito_id
        and quarto
        and getattr(quarto, "rotativo", False)
        and convivente.leito_provisorio_desde
    )


def avaliar_carteirinha_provisoria(
    leito_provisorio_desde: datetime | None,
    *,
    quarto_rotativo: bool,
    agora: datetime | None = None,
) -> dict:
    agora = agora or agora_operacional_naive()
    if not quarto_rotativo or not leito_provisorio_desde:
        return {
            "provisoria": False,
            "bloqueada": False,
            "em_aviso": False,
            "em_tolerancia": False,
            "validade_em": None,
            "aviso_limite_em": None,
            "restante_texto": None,
        }

    fim_janela_aviso = leito_provisorio_desde + timedelta(days=AVISO_CARTEIRINHA_PROVISORIA_DIAS)
    validade_em = leito_provisorio_desde + timedelta(days=VALIDADE_CARTEIRINHA_PROVISORIA_DIAS)
    bloqueada = agora > validade_em

    if bloqueada:
        em_aviso = False
        em_tolerancia = False
        restante_texto = "Carteirinha provisória vencida"
    elif agora <= fim_janela_aviso:
        em_aviso = True
        em_tolerancia = False
        restante_texto = (
            f"{_formatar_restante_operacional(fim_janela_aviso - agora)} "
            "para atualizar a carteirinha"
        )
    else:
        em_aviso = False
        em_tolerancia = True
        restante_texto = (
            f"{_formatar_restante_operacional(validade_em - agora)} "
            "até o bloqueio da carteirinha"
        )

    return {
        "provisoria": True,
        "bloqueada": bloqueada,
        "em_aviso": em_aviso,
        "em_tolerancia": em_tolerancia,
        "validade_em": validade_em,
        "aviso_limite_em": fim_janela_aviso,
        "restante_texto": restante_texto,
    }


async def sincronizar_leito_provisorio_convivente(
    db: AsyncSession,
    convivente,
    novo_leito_id: str | None,
    instituicao_id: str,
) -> None:
    quarto = await obter_quarto_rotativo_do_leito(db, novo_leito_id, instituicao_id)
    if quarto and getattr(quarto, "rotativo", False) and novo_leito_id:
        convivente.leito_provisorio_desde = agora_operacional_naive()
    else:
        convivente.leito_provisorio_desde = None


async def validar_carteirinha_convivente_operacional(
    db: AsyncSession,
    convivente,
    instituicao_id: str,
) -> dict:
    quarto = await obter_quarto_rotativo_do_leito(db, convivente.leito_id, instituicao_id)
    quarto_rotativo = bool(quarto and getattr(quarto, "rotativo", False))

    if quarto_rotativo and convivente.leito_id and not convivente.leito_provisorio_desde:
        status = {
            "provisoria": True,
            "bloqueada": False,
            "em_aviso": True,
            "em_tolerancia": False,
            "validade_em": None,
            "aviso_limite_em": None,
            "restante_texto": "validade não registrada — realoque o leito para renovar",
        }
    else:
        status = avaliar_carteirinha_provisoria(
            convivente.leito_provisorio_desde,
            quarto_rotativo=quarto_rotativo,
        )
    if status["bloqueada"]:
        raise HTTPException(
            status_code=403,
            detail=(
                "Carteirinha provisória vencida. Realoque o convivente em quarto rotativo "
                "(retirar do leito, salvar e alocar novamente) ou mova para quarto definitivo "
                "e reimprima a carteirinha."
            ),
        )
    status["aviso_mensagem"] = None
    if status["provisoria"] and not status["bloqueada"]:
        restante = status.get("restante_texto") or "atualize a carteirinha"
        status["aviso_mensagem"] = (
            f"Carteirinha PROVISÓRIA: {restante}. "
            "Realoque no quarto rotativo ou mova para quarto definitivo e reimprima."
        )
    return status
