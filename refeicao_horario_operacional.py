"""Janelas de horário para registro de refeições na rotina (fuso SP)."""
from __future__ import annotations

from datetime import datetime, time

from fastapi import HTTPException

JANELAS_REFEICAO_OPERACIONAL: dict[str, tuple[time, time]] = {
    "Café da manhã": (time(6, 55), time(8, 30)),
    "Almoço": (time(11, 50), time(14, 30)),
    "Jantar": (time(17, 50), time(20, 30)),
    "Lanche noturno": (time(21, 0), time(22, 30)),
}


def _formatar_hora(valor: time) -> str:
    return valor.strftime("%H:%M")


def validar_horario_refeicao_operacional(tipo_refeicao: str, momento: datetime) -> None:
    janela = JANELAS_REFEICAO_OPERACIONAL.get(tipo_refeicao)
    if not janela:
        return

    hora_atual = momento.time().replace(second=0, microsecond=0)
    inicio, fim = janela
    if inicio <= hora_atual <= fim:
        return

    raise HTTPException(
        status_code=400,
        detail=(
            f"Registro de {tipo_refeicao.lower()} permitido apenas entre "
            f"{_formatar_hora(inicio)} e {_formatar_hora(fim)} (horário de Brasília)."
        ),
    )


def mensagem_indica_horario_refeicao_fora_janela(mensagem: str | None) -> bool:
    texto = str(mensagem or "").lower()
    return "permitido apenas entre" in texto and "horário de brasília" in texto
