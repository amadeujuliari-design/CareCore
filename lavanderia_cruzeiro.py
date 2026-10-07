"""Grade da lavanderia OMO do Cruzeiro do Sul: lavar e secar separados, 45 minutos."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta

DURACAO = timedelta(minutes=45)
MAQUINA_LAVAR = "lavar"
MAQUINA_SECAR = "secar"
_HORA = re.compile(r"^\d{1,2}:\d{2}$")


@dataclass(frozen=True)
class PeriodosLavanderia:
    manha_inicio: time
    manha_fim: time
    tarde_inicio: time
    tarde_fim: time

    def como_dict(self) -> dict[str, str]:
        return {
            "manha_inicio": self.manha_inicio.strftime("%H:%M"),
            "manha_fim": self.manha_fim.strftime("%H:%M"),
            "tarde_inicio": self.tarde_inicio.strftime("%H:%M"),
            "tarde_fim": self.tarde_fim.strftime("%H:%M"),
        }


PADRAO = PeriodosLavanderia(
    manha_inicio=time(7, 0),
    manha_fim=time(12, 15),
    tarde_inicio=time(14, 0),
    tarde_fim=time(18, 30),
)

# A casa PARI já usava o dia das 5h20 às 0h30. A tarde termina no dia seguinte.
PADRAO_PARI = PeriodosLavanderia(
    manha_inicio=time(5, 20),
    manha_fim=time(12, 0),
    tarde_inicio=time(14, 0),
    tarde_fim=time(0, 30),
)


def _hora(valor: str) -> time:
    texto = (valor or "").strip()
    if not _HORA.match(texto):
        raise ValueError("Use o horário no formato HH:MM.")
    hora, minuto = map(int, texto.split(":"))
    if hora > 23 or minuto > 59:
        raise ValueError("Horário inválido.")
    return time(hora, minuto)


def _termino(dia, inicio: time, fim: time) -> datetime:
    """Fim menor que o início cai no dia seguinte, como 14:00–00:30."""
    termino = datetime.combine(dia, fim)
    if fim <= inicio:
        termino += timedelta(days=1)
    return termino


def _cabe_um_uso(dia, inicio: time, fim: time) -> bool:
    comeco = datetime.combine(dia, inicio)
    return comeco + DURACAO <= _termino(dia, inicio, fim)


def validar_periodos(dados: dict) -> PeriodosLavanderia:
    try:
        periodos = PeriodosLavanderia(
            manha_inicio=_hora(dados["manha_inicio"]),
            manha_fim=_hora(dados["manha_fim"]),
            tarde_inicio=_hora(dados["tarde_inicio"]),
            tarde_fim=_hora(dados["tarde_fim"]),
        )
    except KeyError as exc:
        raise ValueError("Informe o começo e o fim da manhã e da tarde.") from exc
    if periodos.manha_inicio >= periodos.manha_fim:
        raise ValueError("A manhã precisa terminar depois de começar.")
    if periodos.tarde_fim == periodos.tarde_inicio:
        raise ValueError("A tarde precisa terminar depois de começar.")
    if periodos.manha_fim > periodos.tarde_inicio:
        raise ValueError("A tarde precisa começar quando a manhã termina ou depois.")
    hoje = datetime.min.date()
    if not _cabe_um_uso(hoje, periodos.manha_inicio, periodos.manha_fim) or not _cabe_um_uso(
        hoje, periodos.tarde_inicio, periodos.tarde_fim
    ):
        raise ValueError("Cada período precisa caber ao menos um uso de 45 minutos.")
    return periodos


def periodos_do_json(texto: str | None, padrao: PeriodosLavanderia | None = None) -> PeriodosLavanderia:
    base = padrao or PADRAO
    if not (texto or "").strip():
        return base
    try:
        dados = json.loads(texto)
    except json.JSONDecodeError:
        return base
    if not isinstance(dados, dict):
        return base
    try:
        return validar_periodos(dados)
    except ValueError:
        return base


def slots_do_dia(dia, periodos: PeriodosLavanderia | None = None) -> list[tuple[datetime, datetime]]:
    atual = periodos or PADRAO
    saida = []
    for inicio_limite, fim_limite in (
        (atual.manha_inicio, atual.manha_fim),
        (atual.tarde_inicio, atual.tarde_fim),
    ):
        cursor = datetime.combine(dia, inicio_limite)
        limite = _termino(dia, inicio_limite, fim_limite)
        while cursor + DURACAO <= limite:
            saida.append((cursor, cursor + DURACAO))
            cursor += DURACAO
    return saida


def eh_slot_lavagem(inicio: datetime, periodos: PeriodosLavanderia | None = None) -> bool:
    return any(marca == inicio for marca, _fim in slots_do_dia(inicio.date(), periodos))


def proxima_secagem(
    fim_lavagem: datetime,
    ocupados: set[datetime],
    dias: int = 15,
    periodos: PeriodosLavanderia | None = None,
):
    for deslocamento in range(dias):
        dia = fim_lavagem.date() + timedelta(days=deslocamento)
        for inicio, fim in slots_do_dia(dia, periodos):
            if inicio < fim_lavagem or inicio in ocupados:
                continue
            return inicio, fim
    return None
