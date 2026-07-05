"""Janelas de horário para registro de refeições na rotina (fuso SP)."""
from __future__ import annotations

from datetime import datetime, time
from typing import Optional

from fastapi import HTTPException

from config_operacional import ConfigOperacionalProjeto, obter_janelas_refeicao
from config_operacional_defaults import REFEICOES_PADRAO

JANELAS_REFEICAO_OPERACIONAL: dict[str, tuple[time, time]] = {
    item["nome"]: (
        time(*map(int, item["inicio"].split(":"))),
        time(*map(int, item["fim"].split(":"))),
    )
    for item in REFEICOES_PADRAO
}


def _formatar_hora(valor: time) -> str:
    return valor.strftime("%H:%M")


def obter_janelas_refeicao_operacional(
    config: Optional[ConfigOperacionalProjeto] = None,
) -> dict[str, tuple[time, time]]:
    if config is None:
        return dict(JANELAS_REFEICAO_OPERACIONAL)
    return obter_janelas_refeicao(config)


def validar_horario_refeicao_operacional(
    tipo_refeicao: str,
    momento: datetime,
    config: Optional[ConfigOperacionalProjeto] = None,
) -> None:
    janelas = obter_janelas_refeicao_operacional(config)
    janela = janelas.get(tipo_refeicao)
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
