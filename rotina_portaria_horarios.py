"""Regras de horário para Entrada/Saída na portaria (fuso operacional SP)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Any, Optional

from fastapi import HTTPException

from config_operacional import ConfigOperacionalProjeto, portaria_para_validacao
from config_operacional_defaults import PORTARIA_PADRAO

HORA_SAIDA_PADRAO = time(*map(int, PORTARIA_PADRAO["hora_saida_padrao"].split(":")))
HORA_ENTRADA_PADRAO = time(*map(int, PORTARIA_PADRAO["hora_entrada_padrao"].split(":")))
HORA_ENTRADA_APOS_PERNOITE_FORA = time(
    *map(int, PORTARIA_PADRAO["hora_entrada_apos_pernoite_fora"].split(":"))
)
HORA_MOVIMENTO_PERNOITE_DENTRO = time(
    *map(int, PORTARIA_PADRAO["hora_movimento_pernoite_dentro"].split(":"))
)
MIN_CARACTERES_JUSTIFICATIVA_HORARIO = PORTARIA_PADRAO["min_caracteres_justificativa"]
MOTIVOS_EXCECAO_PORTARIA = frozenset(PORTARIA_PADRAO["motivos_excecao"])


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


def _limites_portaria(config: Optional[ConfigOperacionalProjeto] = None) -> dict[str, Any]:
    if config is None:
        return {
            "hora_saida_padrao": HORA_SAIDA_PADRAO,
            "hora_entrada_padrao": HORA_ENTRADA_PADRAO,
            "hora_entrada_apos_pernoite_fora": HORA_ENTRADA_APOS_PERNOITE_FORA,
            "hora_movimento_pernoite_dentro": HORA_MOVIMENTO_PERNOITE_DENTRO,
            "min_caracteres_justificativa": MIN_CARACTERES_JUSTIFICATIVA_HORARIO,
            "motivos_excecao": MOTIVOS_EXCECAO_PORTARIA,
        }
    return portaria_para_validacao(config)


def obter_limites_horario_portaria(
    convivente: Any,
    config: Optional[ConfigOperacionalProjeto] = None,
) -> tuple[time, time]:
    limites = _limites_portaria(config)
    motivo = (getattr(convivente, "portaria_excecao_motivo", None) or "").strip().lower()
    if motivo in limites["motivos_excecao"]:
        saida_ate = _parse_hora_opcional(getattr(convivente, "portaria_excecao_saida_ate", None))
        entrada_ate = _parse_hora_opcional(getattr(convivente, "portaria_excecao_entrada_ate", None))
        return (
            saida_ate or limites["hora_saida_padrao"],
            entrada_ate or limites["hora_entrada_padrao"],
        )
    return limites["hora_saida_padrao"], limites["hora_entrada_padrao"]


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
    config: Optional[ConfigOperacionalProjeto] = None,
) -> Optional[str]:
    if tipo_registro not in {"Entrada", "Saída"}:
        return None

    limites = _limites_portaria(config)
    hora_atual = _hora_atual(momento)
    justificativa = (justificativa_horario or "").strip()
    min_chars = limites["min_caracteres_justificativa"]
    hora_entrada_pernoite_fora = limites["hora_entrada_apos_pernoite_fora"]
    hora_movimento_pernoite_dentro = limites["hora_movimento_pernoite_dentro"]

    if pernoitou_fora(ultimo_movimento, momento) and tipo_registro == "Entrada":
        if hora_atual < hora_entrada_pernoite_fora:
            if len(justificativa) < min_chars:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Este convivente pernoitou fora da unidade. "
                        f"A entrada antes das {_formatar_hora(hora_entrada_pernoite_fora)} "
                        f"exige justificativa de no mínimo {min_chars} caracteres."
                    ),
                )
            return justificativa

    if pernoitou_dentro(ultimo_movimento, momento):
        if hora_atual < hora_movimento_pernoite_dentro:
            if len(justificativa) < min_chars:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Este convivente pernoitou dentro da unidade. "
                        f"Movimentação antes das {_formatar_hora(hora_movimento_pernoite_dentro)} "
                        f"exige justificativa de no mínimo {min_chars} caracteres."
                    ),
                )
            return justificativa

    saida_ate, entrada_ate = obter_limites_horario_portaria(convivente, config)

    if tipo_registro == "Saída" and hora_atual > saida_ate:
        if len(justificativa) < min_chars:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Saída após {_formatar_hora(saida_ate)} exige justificativa de no mínimo "
                    f"{min_chars} caracteres."
                ),
            )
        return justificativa

    if tipo_registro == "Entrada" and hora_atual > entrada_ate:
        if len(justificativa) < min_chars:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Entrada após {_formatar_hora(entrada_ate)} exige justificativa de no mínimo "
                    f"{min_chars} caracteres."
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
            or "entrada antes" in texto
            or "movimentação antes" in texto
            or "movimentacao antes" in texto
            or "pernoitou fora" in texto
            or "pernoitou dentro" in texto
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
