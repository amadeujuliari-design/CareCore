"""Grade da lavanderia OMO do Cruzeiro do Sul: lavar e secar separados, 45 minutos."""
from __future__ import annotations

from datetime import datetime, time, timedelta

DURACAO = timedelta(minutes=45)
MAQUINA_LAVAR = "lavar"
MAQUINA_SECAR = "secar"

# O ciclo precisa terminar até 12h e até 18h.
INICIOS = (
    (7, 0),
    (7, 45),
    (8, 30),
    (9, 15),
    (10, 0),
    (10, 45),
    (14, 0),
    (14, 45),
    (15, 30),
    (16, 15),
    (17, 0),
)


def slots_do_dia(dia) -> list[tuple[datetime, datetime]]:
    saida = []
    for hora, minuto in INICIOS:
        inicio = datetime.combine(dia, time(hora, minuto))
        fim = inicio + DURACAO
        if fim.time() > time(12, 0) and inicio.time() < time(12, 0):
            continue
        if fim.time() > time(18, 0) and inicio.time() >= time(14, 0):
            continue
        saida.append((inicio, fim))
    return saida


def eh_slot_lavagem(inicio: datetime) -> bool:
    return any(marca == inicio for marca, _fim in slots_do_dia(inicio.date()))


def proxima_secagem(fim_lavagem: datetime, ocupados: set[datetime], dias: int = 15):
    for deslocamento in range(dias):
        dia = fim_lavagem.date() + timedelta(days=deslocamento)
        for inicio, fim in slots_do_dia(dia):
            if inicio < fim_lavagem or inicio in ocupados:
                continue
            return inicio, fim
    return None
