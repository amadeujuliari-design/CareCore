"""Geração de datas de sessão para o módulo Atividades."""
from __future__ import annotations

import json
from calendar import monthrange
from datetime import date
from typing import Any


TIPOS_FREQUENCIA_VALIDOS = frozenset({
    "diaria",
    "semanal",
    "bisemanal",
    "dias_mes",
})


def parse_configuracao_agenda(valor: str | dict | None) -> dict[str, Any]:
    if valor is None:
        return {}
    if isinstance(valor, dict):
        return valor
    texto = str(valor).strip()
    if not texto:
        return {}
    try:
        dados = json.loads(texto)
    except json.JSONDecodeError:
        return {}
    return dados if isinstance(dados, dict) else {}


def serializar_configuracao_agenda(config: dict[str, Any] | None) -> str:
    return json.dumps(config or {}, ensure_ascii=False)


def _dias_do_mes(ano: int, mes: int) -> list[date]:
    _, ultimo = monthrange(ano, mes)
    return [date(ano, mes, dia) for dia in range(1, ultimo + 1)]


def _eh_dia_util(dia: date) -> bool:
    return dia.weekday() < 5


def gerar_datas_ocorrencias_mes(
    ano: int,
    mes: int,
    tipo_frequencia: str,
    config: dict[str, Any] | str | None,
) -> list[date]:
    tipo = str(tipo_frequencia or "").strip().lower()
    if tipo not in TIPOS_FREQUENCIA_VALIDOS:
        raise ValueError("Tipo de frequência inválido.")

    cfg = parse_configuracao_agenda(config)
    somente_uteis = bool(cfg.get("somente_dias_uteis"))
    dias_semana = {int(x) for x in (cfg.get("dias_semana") or []) if str(x).isdigit() or isinstance(x, int)}
    datas_especificas = cfg.get("datas_especificas") or []
    max_sessoes = cfg.get("max_sessoes_mes")

    resultado: list[date] = []
    dias_mes = _dias_do_mes(ano, mes)

    if tipo == "dias_mes":
        for item in datas_especificas:
            try:
                dia = date.fromisoformat(str(item)[:10])
            except ValueError:
                continue
            if dia.year == ano and dia.month == mes:
                resultado.append(dia)
    elif tipo == "diaria":
        for dia in dias_mes:
            if somente_uteis and not _eh_dia_util(dia):
                continue
            resultado.append(dia)
    elif tipo in {"semanal", "bisemanal"}:
        if not dias_semana:
            raise ValueError("Informe os dias da semana para esta frequência.")
        if tipo == "bisemanal" and len(dias_semana) != 2:
            raise ValueError("Para 2x na semana, selecione exatamente 2 dias.")
        for dia in dias_mes:
            if dia.weekday() in dias_semana:
                resultado.append(dia)
    else:
        raise ValueError("Tipo de frequência inválido.")

    resultado = sorted(set(resultado))
    if max_sessoes:
        try:
            limite = int(max_sessoes)
        except (TypeError, ValueError):
            limite = 0
        if limite > 0:
            resultado = resultado[:limite]
    return resultado


def mes_referencia_de(ano: int, mes: int) -> str:
    return f"{ano:04d}-{mes:02d}"


def parse_mes_referencia(valor: str) -> tuple[int, int]:
    texto = str(valor or "").strip()
    if len(texto) != 7 or texto[4] != "-":
        raise ValueError("Mês de referência inválido. Use AAAA-MM.")
    ano = int(texto[:4])
    mes = int(texto[5:7])
    if mes < 1 or mes > 12:
        raise ValueError("Mês de referência inválido.")
    return ano, mes
