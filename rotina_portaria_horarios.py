"""Regras de horário para Entrada/Saída na portaria (fuso operacional SP)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Any, Optional

from fastapi import HTTPException

HORA_SAIDA_PADRAO = time(17, 0)
HORA_ENTRADA_PADRAO = time(19, 0)
HORA_ENTRADA_APOS_PERNOITE_FORA = time(11, 0)
HORA_MOVIMENTO_PERNOITE_DENTRO = time(4, 0)
MIN_CARACTERES_JUSTIFICATIVA_HORARIO = 30

MOTIVOS_EXCECAO_PORTARIA = frozenset({"estudante", "trabalho", "saude", "eventual"})


@dataclass(frozen=True)
class UltimoMovimentoPortaria:
    tipo_registro: str
    data_registro: datetime


def _parse_hora_opcional(valor: Optional[str]) -> Optional[time]:
    if not valor:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    partes = texto.split(":")
    if len(partes) < 2:
        return None
    try:
        hora = int(partes[0])
        minuto = int(partes[1])
        return time(hora, minuto)
    except (TypeError, ValueError):
        return None


def _hora_atual(momento: datetime) -> time:
    return momento.time().replace(second=0, microsecond=0)


def _formatar_hora(valor: time) -> str:
    return valor.strftime("%H:%M")


def obter_limites_horario_portaria(convivente: Any) -> tuple[time, time]:
    motivo = (getattr(convivente, "portaria_excecao_motivo", None) or "").strip().lower()
    if motivo in MOTIVOS_EXCECAO_PORTARIA:
        saida_ate = _parse_hora_opcional(getattr(convivente, "portaria_excecao_saida_ate", None))
        entrada_ate = _parse_hora_opcional(getattr(convivente, "portaria_excecao_entrada_ate", None))
        return (
            saida_ate or HORA_SAIDA_PADRAO,
            entrada_ate or HORA_ENTRADA_PADRAO,
        )
    return HORA_SAIDA_PADRAO, HORA_ENTRADA_PADRAO


def pernoitou_fora(ultimo_movimento: Optional[UltimoMovimentoPortaria], momento: datetime) -> bool:
    if not ultimo_movimento or ultimo_movimento.tipo_registro != "Saída":
        return False
    return ultimo_movimento.data_registro.date() < momento.date()


def pernoitou_dentro(ultimo_movimento: Optional[UltimoMovimentoPortaria], momento: datetime) -> bool:
    if not ultimo_movimento or ultimo_movimento.tipo_registro != "Entrada":
        return False
    return ultimo_movimento.data_registro.date() < momento.date()


def validar_horario_portaria(
    *,
    tipo_registro: str,
    momento: datetime,
    convivente: Any,
    ultimo_movimento: Optional[UltimoMovimentoPortaria],
    justificativa_horario: Optional[str] = None,
) -> Optional[str]:
    if tipo_registro not in {"Entrada", "Saída"}:
        return None

    hora_atual = _hora_atual(momento)
    justificativa = (justificativa_horario or "").strip()

    if pernoitou_fora(ultimo_movimento, momento) and tipo_registro == "Entrada":
        if hora_atual < HORA_ENTRADA_APOS_PERNOITE_FORA:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Este convivente pernoitou fora da unidade. "
                    f"A entrada só pode ser registrada a partir das {_formatar_hora(HORA_ENTRADA_APOS_PERNOITE_FORA)}."
                ),
            )

    if pernoitou_dentro(ultimo_movimento, momento):
        if hora_atual < HORA_MOVIMENTO_PERNOITE_DENTRO:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Este convivente pernoitou dentro da unidade. "
                    f"Saída e entrada só podem ser registradas a partir das {_formatar_hora(HORA_MOVIMENTO_PERNOITE_DENTRO)}."
                ),
            )

    saida_ate, entrada_ate = obter_limites_horario_portaria(convivente)

    if tipo_registro == "Saída" and hora_atual > saida_ate:
        if len(justificativa) < MIN_CARACTERES_JUSTIFICATIVA_HORARIO:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Saída após {_formatar_hora(saida_ate)} exige justificativa de no mínimo "
                    f"{MIN_CARACTERES_JUSTIFICATIVA_HORARIO} caracteres."
                ),
            )
        return justificativa

    if tipo_registro == "Entrada" and hora_atual > entrada_ate:
        if len(justificativa) < MIN_CARACTERES_JUSTIFICATIVA_HORARIO:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Entrada após {_formatar_hora(entrada_ate)} exige justificativa de no mínimo "
                    f"{MIN_CARACTERES_JUSTIFICATIVA_HORARIO} caracteres."
                ),
            )
        return justificativa

    return None


def mensagem_indica_justificativa_horario_portaria(mensagem: str | None) -> bool:
    texto = str(mensagem or "").lower()
    return (
        "justificativa" in texto
        and (
            "saída após" in texto
            or "saida apos" in texto
            or "entrada após" in texto
            or "entrada apos" in texto
        )
    )


def mensagem_indica_portaria_bloqueada_sem_justificativa(mensagem: str | None) -> bool:
    if mensagem_indica_justificativa_horario_portaria(mensagem):
        return False
    texto = str(mensagem or "").lower()
    return (
        "pernoitou fora da unidade" in texto
        or "pernoitou dentro da unidade" in texto
    )
