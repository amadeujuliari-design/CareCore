# -*- coding: utf-8 -*-
"""Janela de uso do módulo Compras para usuários do projeto (dias úteis 8h–18h SP)."""
from __future__ import annotations

from datetime import date, datetime, time

from time_operacional import agora_operacional_naive

# Feriados nacionais fixos (mês, dia) — sem ponto facultativo.
_FERIADOS_FIXOS = (
    (1, 1),
    (4, 21),
    (5, 1),
    (9, 7),
    (10, 12),
    (11, 2),
    (11, 15),
    (11, 20),
    (12, 25),
)

# Feriados móveis / pontuais conhecidos (AAAA-MM-DD) — ampliar conforme calendário AEB.
_FERIADOS_EXTRAS = {
    date(2026, 2, 16),  # Carnaval
    date(2026, 2, 17),  # Carnaval
    date(2026, 4, 3),  # Sexta-feira Santa
    date(2026, 6, 4),  # Corpus Christi
    date(2027, 2, 8),
    date(2027, 2, 9),
    date(2027, 3, 26),
    date(2027, 5, 27),
}

HORA_INICIO = time(8, 0)
HORA_FIM = time(18, 0)


def eh_feriado_nacional(dia: date) -> bool:
    if (dia.month, dia.day) in _FERIADOS_FIXOS:
        return True
    return dia in _FERIADOS_EXTRAS


def eh_dia_util_compras(dia: date | None = None) -> bool:
    ref = dia or agora_operacional_naive().date()
    if ref.weekday() >= 5:
        return False
    return not eh_feriado_nacional(ref)


def dentro_horario_comercial_compras(momento: datetime | None = None) -> bool:
    agora = momento or agora_operacional_naive()
    if not eh_dia_util_compras(agora.date()):
        return False
    hora = agora.time()
    return HORA_INICIO <= hora < HORA_FIM


def mensagem_bloqueio_compras_projeto(momento: datetime | None = None) -> str:
    agora = momento or agora_operacional_naive()
    if agora.weekday() >= 5:
        return (
            "O módulo Compras do projeto funciona apenas em dias úteis, "
            "das 8:00 às 18:00 (horário de Brasília). Finais de semana estão bloqueados."
        )
    if eh_feriado_nacional(agora.date()):
        return (
            "O módulo Compras do projeto está bloqueado em feriados. "
            "Use o sistema em dias úteis, das 8:00 às 18:00 (horário de Brasília)."
        )
    return (
        "O módulo Compras do projeto funciona apenas em dias úteis, "
        "das 8:00 às 18:00 (horário de Brasília)."
    )


def perfil_projeto_sujeito_horario(perfil: str | None) -> bool:
    from security import normalizar_perfil_acesso

    p = normalizar_perfil_acesso(str(perfil or "").strip())
    return p in {"Gestor", "Técnico", "Administrativo", "ADM Pedidos", "Orientador"}


def usuario_projeto_bloqueado_horario_compras(usuario: dict) -> str | None:
    """Devolve mensagem de bloqueio ou None se pode operar."""
    if usuario.get("is_manutencao") or usuario.get("is_master") or usuario.get("is_global"):
        return None
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    # Sede Compras (Infra/Suprimentos) não entra no bloqueio do projeto.
    from compras_regras import usuario_e_sede_compras

    if usuario_e_sede_compras(perfil=perfil, is_manutencao=bool(usuario.get("is_manutencao"))):
        return None
    if not perfil_projeto_sujeito_horario(perfil):
        return None
    if dentro_horario_comercial_compras():
        return None
    return mensagem_bloqueio_compras_projeto()
