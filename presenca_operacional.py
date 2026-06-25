"""Regras operacionais de presença, ausência e alertas da rotina (fuso SP)."""
from __future__ import annotations

from datetime import date, datetime, timedelta

TIPOS_FLUXO_ENTRADA_SAIDA = frozenset({"Entrada", "Saída"})


def _movimentos_fluxo_ordenados(movimentos: list[dict]) -> list[dict]:
    return sorted(
        [
            movimento
            for movimento in movimentos
            if movimento.get("tipo_registro") in TIPOS_FLUXO_ENTRADA_SAIDA
        ],
        key=lambda movimento: movimento["data_registro"],
    )


def _ja_estava_no_projeto(dia: date, data_entrada: date | None) -> bool:
    """Sem histórico de fluxo: assume dentro se já estava admitido no projeto."""
    return data_entrada is None or dia >= data_entrada


def convivente_presente_no_dia(
    movimentos: list[dict],
    dia: date,
    *,
    data_entrada: date | None = None,
    ausencia_justificada: bool = False,
) -> bool:
    """
    Presente no dia (00:00:01–23:59:59): entrou, já estava dentro ou ausência justificada.
    Independente de outras interações (refeição, banho etc.).
    """
    if ausencia_justificada:
        return True

    return dia.isoformat() in calcular_dias_presenca_operacional(
        movimentos,
        dia,
        dia,
        data_entrada,
    )


def calcular_dias_presenca_operacional(
    movimentos: list[dict],
    data_inicio: date,
    data_fim: date,
    data_entrada: date | None = None,
) -> list[str]:
    movimentos_ordenados = _movimentos_fluxo_ordenados(movimentos)
    dias_presentes: list[str] = []
    dia = data_inicio

    while dia <= data_fim:
        if data_entrada and dia < data_entrada:
            dia += timedelta(days=1)
            continue

        inicio_dia = datetime.combine(dia, datetime.min.time())
        fim_dia = datetime.combine(dia, datetime.max.time())

        ultimo_antes_do_dia = None
        ultimo_ate_fim_do_dia = None
        entrou_no_dia = False

        for movimento in movimentos_ordenados:
            data_movimento = movimento["data_registro"]

            if data_movimento < inicio_dia:
                ultimo_antes_do_dia = movimento
                ultimo_ate_fim_do_dia = movimento
                continue

            if data_movimento > fim_dia:
                break

            ultimo_ate_fim_do_dia = movimento
            if movimento["tipo_registro"] == "Entrada":
                entrou_no_dia = True

        if ultimo_antes_do_dia is not None:
            amanheceu_dentro = ultimo_antes_do_dia["tipo_registro"] == "Entrada"
        else:
            amanheceu_dentro = _ja_estava_no_projeto(dia, data_entrada)

        if ultimo_ate_fim_do_dia is not None:
            dentro_no_fechamento = ultimo_ate_fim_do_dia["tipo_registro"] == "Entrada"
        else:
            dentro_no_fechamento = amanheceu_dentro or entrou_no_dia

        if dentro_no_fechamento or amanheceu_dentro or entrou_no_dia:
            dias_presentes.append(dia.isoformat())

        dia += timedelta(days=1)

    return dias_presentes


def convivente_dentro_por_ultimo_fluxo(ultimo_movimento_fluxo: dict | None) -> bool:
    """Estado atual: dentro do projeto (último fluxo Entrada ou sem saída registrada)."""
    if not ultimo_movimento_fluxo:
        return True
    return ultimo_movimento_fluxo.get("tipo_registro") != "Saída"


def convivente_ausente_saida_ontem_sem_retorno(
    movimentos_fluxo: list[dict],
    dia_referencia: date,
) -> bool:
    """
    Ausente operacional: ativo que registrou saída ontem e não retornou (Entrada) hoje.
    """
    ontem = dia_referencia - timedelta(days=1)
    inicio_ontem = datetime.combine(ontem, datetime.min.time())
    fim_ontem = datetime.combine(ontem, datetime.max.time())
    inicio_hoje = datetime.combine(dia_referencia, datetime.min.time())
    fim_hoje = datetime.combine(dia_referencia, datetime.max.time())

    ultimo_ontem = None
    for movimento in _movimentos_fluxo_ordenados(movimentos_fluxo):
        data_movimento = movimento["data_registro"]
        if data_movimento < inicio_ontem:
            continue
        if data_movimento > fim_ontem:
            break
        ultimo_ontem = movimento

    if not ultimo_ontem or ultimo_ontem["tipo_registro"] != "Saída":
        return False

    for movimento in _movimentos_fluxo_ordenados(movimentos_fluxo):
        data_movimento = movimento["data_registro"]
        if data_movimento < inicio_hoje:
            continue
        if data_movimento > fim_hoje:
            break
        if movimento["tipo_registro"] == "Entrada":
            return False

    return True


def sem_interacao_rotina_24h(
    ultimo_registro_em: datetime | None,
    agora: datetime,
) -> bool:
    """Sem qualquer registro de rotina nas últimas 24 horas."""
    if ultimo_registro_em is None:
        return True
    return (agora - ultimo_registro_em) >= timedelta(hours=24)


MAX_DIAS_RELATORIO_PRESENCA = 93

STATUS_DIA_NA = "na"
STATUS_DIA_PRESENTE = "presente"
STATUS_DIA_JUSTIFICADO = "justificado"
STATUS_DIA_AUSENTE = "ausente"


def listar_dias_periodo(data_inicio: date, data_fim: date) -> list[date]:
    dias: list[date] = []
    dia = data_inicio
    while dia <= data_fim:
        dias.append(dia)
        dia += timedelta(days=1)
    return dias


def _dia_com_ausencia_justificada(
    dia: date,
    *,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
) -> bool:
    if status_convivente != "Ausência justificada":
        return False
    if ausencia_justificada_desde is None:
        return True
    return dia >= ausencia_justificada_desde


def classificar_presenca_dia(
    dia: date,
    *,
    data_entrada: date | None,
    dias_presentes: set[str],
    status_convivente: str,
    ausencia_justificada_desde: date | None,
) -> str:
    if data_entrada and dia < data_entrada:
        return STATUS_DIA_NA
    if _dia_com_ausencia_justificada(
        dia,
        status_convivente=status_convivente,
        ausencia_justificada_desde=ausencia_justificada_desde,
    ):
        return STATUS_DIA_JUSTIFICADO
    if dia.isoformat() in dias_presentes:
        return STATUS_DIA_PRESENTE
    return STATUS_DIA_AUSENTE


def montar_status_presenca_por_dia(
    movimentos_fluxo: list[dict],
    data_inicio: date,
    data_fim: date,
    *,
    data_entrada: date | None,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
) -> dict[str, str]:
    dias_presentes = set(
        calcular_dias_presenca_operacional(
            movimentos_fluxo,
            data_inicio,
            data_fim,
            data_entrada,
        )
    )
    return {
        dia.isoformat(): classificar_presenca_dia(
            dia,
            data_entrada=data_entrada,
            dias_presentes=dias_presentes,
            status_convivente=status_convivente,
            ausencia_justificada_desde=ausencia_justificada_desde,
        )
        for dia in listar_dias_periodo(data_inicio, data_fim)
    }


def totais_status_presenca(status_por_dia: dict[str, str]) -> dict[str, int]:
    presentes = 0
    justificados = 0
    ausentes = 0
    na = 0

    for status in status_por_dia.values():
        if status == STATUS_DIA_PRESENTE:
            presentes += 1
        elif status == STATUS_DIA_JUSTIFICADO:
            justificados += 1
        elif status == STATUS_DIA_AUSENTE:
            ausentes += 1
        else:
            na += 1

    return {
        "presentes": presentes + justificados,
        "presentes_operacionais": presentes,
        "justificados": justificados,
        "ausentes": ausentes,
        "na": na,
    }


def linha_atende_filtro_situacao_periodo(
    totais: dict[str, int],
    filtro_situacao: str | None,
) -> bool:
    """
    Filtro do relatório matricial:
    - presenca_ou_justificada: pelo menos 1 dia P ou J no período
    - apenas_ausencia: pelo menos 1 dia A no período
    """
    filtro = (filtro_situacao or "presenca_ou_justificada").strip()
    if filtro == "apenas_ausencia":
        return int(totais.get("ausentes") or 0) > 0
    return (
        int(totais.get("presentes_operacionais") or 0) > 0
        or int(totais.get("justificados") or 0) > 0
    )
