"""Reconciliação excepcional jun/2026: PDF SIAT como retrato operacional dias 1–N."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from presenca_operacional import (
    STATUS_DIA_PRESENTE,
    montar_status_presenca_por_dia,
)
from presencas_pdf_operacional_plan import (
    HORA_ENTRADA,
    HORA_SAIDA,
    OBSERVACAO_IMPORT,
    STATUS_AJ,
    STATUS_ATIVO,
    STATUS_INATIVADO,
    STATUS_VINCULACAO_ATIVA,
    MovimentoPlano,
    chave_movimento,
    status_carecore_no_dia,
)

DATA_CORTE_FORA_PDF = date(2026, 5, 31)
INICIO_JUNHO_2026 = date(2026, 6, 1)


def dias_pdf_no_periodo(
    dias_pdf: set[int],
    *,
    dia_limite: int,
    dias_protegidos: set[date],
    ano: int,
    mes: int,
) -> set[int]:
    dias = {dia for dia in dias_pdf if 1 <= dia <= dia_limite}
    protegidos = {
        dia.day
        for dia in dias_protegidos
        if dia.year == ano and dia.month == mes
    }
    return dias - protegidos


def dias_protegidos_para_importacao(
    *,
    reconciliar: bool,
    hoje: date,
    ontem: date,
    ano: int,
    mes: int,
    dia_limite: int,
) -> set[date]:
    """
    Reconciliação do PDF fechado (ex.: jun/2026 dias 1–N): não protege hoje/ontem.
    Importação operacional corrente: preserva rotina real dos últimos 2 dias.
    """
    if reconciliar:
        return set()
    inicio = date(ano, mes, 1)
    fim = date(ano, mes, dia_limite)
    return {
        dia
        for dia in (hoje, ontem)
        if inicio <= dia <= fim
    }


def calcular_data_inativacao_pdf(
    dias_pdf: set[int],
    *,
    ano: int,
    mes: int,
    dia_limite: int,
    presenca_dia_25: bool,
) -> date | None:
    if presenca_dia_25:
        return None

    dias_no_periodo = {dia for dia in dias_pdf if 1 <= dia <= dia_limite}
    if not dias_no_periodo:
        return INICIO_JUNHO_2026

    ultimo_dia = max(dias_no_periodo)
    if ultimo_dia >= dia_limite:
        return date(ano, mes, dia_limite) + timedelta(days=1)
    return date(ano, mes, ultimo_dia + 1)


def _fluxo_para_simulacao(
    movimentos_reais: list[dict],
    movimentos_plano: list[MovimentoPlano],
) -> list[dict]:
    fluxo = list(movimentos_reais)
    for movimento in movimentos_plano:
        fluxo.append(
            {
                "tipo_registro": movimento.tipo_registro,
                "data_registro": movimento.data_registro,
            }
        )
    return sorted(fluxo, key=lambda item: item["data_registro"])


def planejar_correcoes_ausencia_pdf(
    *,
    convivente_id: str,
    ano: int,
    mes: int,
    dias_pdf: set[int],
    dia_limite: int,
    dias_protegidos: set[date],
    movimentos_existentes: list[dict],
    movimentos_plano: list[MovimentoPlano],
    data_vinculacao: date | None,
    data_inativacao: date | None,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
    chaves_existentes: set[str],
) -> list[MovimentoPlano]:
    """Saídas nos dias em que o PDF marca ausência mas o fluxo ainda fecha presente."""
    correcoes: list[MovimentoPlano] = []
    fluxo = _fluxo_para_simulacao(movimentos_existentes, movimentos_plano)

    for numero_dia in range(1, dia_limite + 1):
        if numero_dia in dias_pdf:
            continue
        dia = date(ano, mes, numero_dia)
        if dia in dias_protegidos:
            continue

        status = status_carecore_no_dia(
            fluxo,
            dia,
            data_vinculacao=data_vinculacao,
            data_inativacao=data_inativacao,
            status_convivente=status_convivente,
            ausencia_justificada_desde=ausencia_justificada_desde,
        )
        if status != STATUS_DIA_PRESENTE:
            continue

        quando = datetime(ano, mes, numero_dia, HORA_SAIDA[0], HORA_SAIDA[1])
        chave = chave_movimento(convivente_id, "Saída", quando)
        if chave in chaves_existentes:
            continue

        movimento = MovimentoPlano(
            tipo_registro="Saída",
            data_registro=quando,
            observacao=f"{OBSERVACAO_IMPORT}; reconciliacao ausencia PDF",
            chave_idempotencia=chave,
        )
        correcoes.append(movimento)
        chaves_existentes.add(chave)
        fluxo.append(
            {
                "tipo_registro": movimento.tipo_registro,
                "data_registro": movimento.data_registro,
            }
        )
        fluxo.sort(key=lambda item: item["data_registro"])

    return correcoes


def planejar_complemento_presenca_pdf(
    *,
    convivente_id: str,
    ano: int,
    mes: int,
    dias_pdf: set[int],
    dia_limite: int,
    presenca_dia_25: bool,
    movimentos_existentes: list[dict],
    movimentos_plano: list[MovimentoPlano],
    data_vinculacao: date | None,
    data_inativacao: date | None,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
    chaves_existentes: set[str],
) -> list[MovimentoPlano]:
    """
    Garante P nos dias marcados no PDF quando importações anteriores deixaram lacunas
    (ex.: saída no dia 24 sem entrada no 25, ou chaves antigas que não fecham P).
    """
    complementos: list[MovimentoPlano] = []

    for numero_dia in sorted(dias_pdf):
        if numero_dia < 1 or numero_dia > dia_limite:
            continue

        fluxo = _fluxo_para_simulacao(movimentos_existentes, movimentos_plano + complementos)
        dia = date(ano, mes, numero_dia)
        status = status_carecore_no_dia(
            fluxo,
            dia,
            data_vinculacao=data_vinculacao,
            data_inativacao=data_inativacao,
            status_convivente=status_convivente,
            ausencia_justificada_desde=ausencia_justificada_desde,
        )
        if status == STATUS_DIA_PRESENTE:
            continue

        manter_dentro_no_25 = (
            presenca_dia_25
            and numero_dia == dia_limite
            and numero_dia == 25
        )
        pares: list[tuple[str, datetime, str]] = []
        entrada_quando = datetime(ano, mes, numero_dia, HORA_ENTRADA[0], HORA_ENTRADA[1])
        pares.append(("Entrada", entrada_quando, OBSERVACAO_IMPORT))
        if not manter_dentro_no_25:
            saida_quando = datetime(ano, mes, numero_dia, HORA_SAIDA[0], HORA_SAIDA[1])
            pares.append(
                (
                    "Saída",
                    saida_quando,
                    f"{OBSERVACAO_IMPORT}; complemento presenca PDF",
                )
            )

        for tipo, quando, observacao in pares:
            chave = chave_movimento(convivente_id, tipo, quando)
            if chave in chaves_existentes:
                continue
            movimento = MovimentoPlano(
                tipo_registro=tipo,
                data_registro=quando,
                observacao=observacao,
                chave_idempotencia=chave,
            )
            complementos.append(movimento)
            chaves_existentes.add(chave)

    return complementos


def montar_atualizacao_cadastro_pdf(
    *,
    presenca_dia_25: bool,
    ausencia_justificada_pdf: bool,
    dias_pdf: set[int],
    ano: int,
    mes: int,
    dia_limite: int,
    data_vinculacao_alvo: date,
    retroagir: bool,
) -> dict:
    status_final, aplicar_aj = _status_final_reconciliacao(
        presenca_dia_25=presenca_dia_25,
        ausencia_justificada_pdf=ausencia_justificada_pdf,
    )
    data_inativacao = calcular_data_inativacao_pdf(
        dias_pdf,
        ano=ano,
        mes=mes,
        dia_limite=dia_limite,
        presenca_dia_25=presenca_dia_25,
    )

    atualizacao: dict = {"status": status_final}
    if status_final == STATUS_ATIVO:
        atualizacao["data_inativacao"] = None
        atualizacao["ausencia_justificada_desde"] = None
    elif status_final == STATUS_AJ:
        atualizacao["data_inativacao"] = None
        # Sem data fixa: J nos dias sem P; dias com fluxo permanecem P.
        atualizacao["ausencia_justificada_desde"] = None
    else:
        atualizacao["data_inativacao"] = data_inativacao
        atualizacao["ausencia_justificada_desde"] = None

    if retroagir:
        atualizacao["data_entrada"] = data_vinculacao_alvo
        atualizacao["data_inclusao"] = data_vinculacao_alvo

    return atualizacao


def _status_final_reconciliacao(
    *,
    presenca_dia_25: bool,
    ausencia_justificada_pdf: bool,
) -> tuple[str, bool]:
    if presenca_dia_25:
        return STATUS_ATIVO, False
    if ausencia_justificada_pdf:
        return STATUS_AJ, True
    return STATUS_INATIVADO, False


def montar_atualizacao_fora_pdf(convivente) -> dict | None:
    """Quem não está no PDF de junho não compõe presença do período."""
    atualizacao: dict = {}
    precisa = False

    inativacao = convivente.data_inativacao
    if inativacao is None or inativacao >= INICIO_JUNHO_2026:
        atualizacao["data_inativacao"] = DATA_CORTE_FORA_PDF
        precisa = True

    if convivente.status in STATUS_VINCULACAO_ATIVA:
        atualizacao["status"] = STATUS_INATIVADO
        precisa = True

    if convivente.status == STATUS_AJ:
        atualizacao["status"] = STATUS_INATIVADO
        atualizacao["ausencia_justificada_desde"] = None
        precisa = True

    if not precisa:
        return None
    return atualizacao


def contar_presencas_pdf(pessoas, *, dia_limite: int) -> int:
    total = 0
    for pessoa in pessoas:
        for dia in pessoa.dias:
            if 1 <= dia <= dia_limite:
                total += 1
    return total


def simular_presencas_carecore_apos_plano(
    linhas_plano: list[dict],
    *,
    ano: int,
    mes: int,
    dia_limite: int,
    movimentos_por_id: dict[str, list[dict]],
    conviventes_por_id: dict,
    data_vinculacao_alvo: date,
) -> tuple[int, dict[str, int]]:
    """Retorna total P simulado e P por dia para conviventes do PDF."""
    por_dia: dict[str, int] = {}
    total = 0

    for linha in linhas_plano:
        if linha["tipo"] != "plano_movimentos":
            continue

        convivente = linha["convivente"]
        movimentos_todos = movimentos_por_id.get(convivente.id, [])
        fluxo = _fluxo_para_simulacao(movimentos_todos, linha["movimentos"])

        cadastro = linha.get("cadastro_reconciliacao") or {}
        vinculacao = cadastro.get("data_inclusao") or cadastro.get("data_entrada")
        if vinculacao is None:
            vinculacao = convivente.data_inclusao or convivente.data_entrada or data_vinculacao_alvo

        status_map = montar_status_presenca_por_dia(
            fluxo,
            date(ano, mes, 1),
            date(ano, mes, dia_limite),
            data_entrada=vinculacao,
            data_inativacao=cadastro.get("data_inativacao"),
            status_convivente=cadastro.get("status", convivente.status),
            ausencia_justificada_desde=cadastro.get("ausencia_justificada_desde"),
        )

        for iso, status in status_map.items():
            if status == STATUS_DIA_PRESENTE:
                total += 1
                por_dia[iso] = por_dia.get(iso, 0) + 1

    return total, por_dia
