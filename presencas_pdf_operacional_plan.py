"""Planejamento puro da importação de presenças PDF SIAT → rotina operacional."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from presenca_operacional import (
    STATUS_DIA_AUSENTE,
    STATUS_DIA_JUSTIFICADO,
    STATUS_DIA_NA,
    STATUS_DIA_PRESENTE,
    montar_status_presenca_por_dia,
)

OBSERVACAO_IMPORT = "IMPORTACAO_PDF_SIAT_JUN2026"
HORA_ENTRADA = (8, 0)
HORA_SAIDA = (20, 0)
HORA_SAIDA_PRE_PERIODO = (20, 0)

STATUS_ATIVO = "Ativo"
STATUS_INATIVADO = "Inativado"
STATUS_AJ = "Ausência justificada"
STATUS_VINCULACAO_ATIVA = frozenset({"Ativo", "Em acolhimento"})


@dataclass(frozen=True)
class MovimentoPlano:
    tipo_registro: str
    data_registro: datetime
    observacao: str
    chave_idempotencia: str


@dataclass(frozen=True)
class PlanoConvivente:
    convivente_id: str
    dias_pdf: frozenset[int]
    ausencia_justificada_pdf: bool
    presenca_dia_25: bool
    status_final: str
    aplicar_aj_cadastro: bool
    retroagir_datas: bool
    movimentos: tuple[MovimentoPlano, ...]
    acao_match: str
    detalhes: str


def normalizar_digits(valor: str | None) -> str:
    return "".join(ch for ch in (valor or "") if ch.isdigit())


def construir_blocos_consecutivos(dias: set[int]) -> list[tuple[int, int]]:
    if not dias:
        return []
    ordenados = sorted(dias)
    blocos: list[tuple[int, int]] = []
    inicio = fim = ordenados[0]
    for dia in ordenados[1:]:
        if dia == fim + 1:
            fim = dia
            continue
        blocos.append((inicio, fim))
        inicio = fim = dia
    blocos.append((inicio, fim))
    return blocos


def _datetime_dia(ano: int, mes: int, dia: int, hora: int, minuto: int) -> datetime:
    return datetime(ano, mes, dia, hora, minuto, 0)


def chave_movimento(convivente_id: str, tipo: str, quando: datetime) -> str:
    return f"{OBSERVACAO_IMPORT}|{convivente_id}|{tipo}|{quando.isoformat(timespec='seconds')}"


def status_carecore_no_dia(
    movimentos_fluxo: list[dict],
    dia: date,
    *,
    data_vinculacao: date | None,
    data_inativacao: date | None,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
) -> str:
    mapa = montar_status_presenca_por_dia(
        movimentos_fluxo,
        dia,
        dia,
        data_entrada=data_vinculacao,
        data_inativacao=data_inativacao,
        status_convivente=status_convivente,
        ausencia_justificada_desde=ausencia_justificada_desde,
    )
    return mapa[dia.isoformat()]


def dia_tem_fluxo_real(
    movimentos_fluxo: list[dict],
    dia: date,
) -> bool:
    inicio = datetime.combine(dia, datetime.min.time())
    fim = datetime.combine(dia, datetime.max.time())
    return any(
        inicio <= movimento["data_registro"] <= fim
        for movimento in movimentos_fluxo
    )


def carecore_tem_presenca_computada(status: str) -> bool:
    return status in {STATUS_DIA_PRESENTE, STATUS_DIA_JUSTIFICADO}


def decidir_dias_presentes_importar(
    *,
    ano: int,
    mes: int,
    dias_pdf: set[int],
    dia_limite_importacao: int,
    dias_protegidos: set[date],
    movimentos_reais: list[dict],
    data_vinculacao: date | None,
    data_inativacao: date | None,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
) -> set[int]:
    """Importa dias do PDF salvo dias protegidos e presença já explícita no CareCore+."""
    importar: set[int] = set()
    tem_fluxo_real = bool(movimentos_reais)

    for numero_dia in range(1, dia_limite_importacao + 1):
        dia = date(ano, mes, numero_dia)
        if dia in dias_protegidos:
            continue

        pdf_presente = numero_dia in dias_pdf
        if not pdf_presente:
            continue

        status_cc = status_carecore_no_dia(
            movimentos_reais,
            dia,
            data_vinculacao=data_vinculacao,
            data_inativacao=data_inativacao,
            status_convivente=status_convivente,
            ausencia_justificada_desde=ausencia_justificada_desde,
        )

        if status_cc == STATUS_DIA_JUSTIFICADO:
            continue
        if tem_fluxo_real and status_cc == STATUS_DIA_PRESENTE:
            continue
        importar.add(numero_dia)
    return importar


def planejar_movimentos_convivente(
    *,
    convivente_id: str,
    ano: int,
    mes: int,
    dias_importar: set[int],
    dia_limite_importacao: int,
    presenca_dia_25: bool,
    respeitar_dentro_no_25: bool,
    chaves_existentes: set[str],
) -> list[MovimentoPlano]:
    if not dias_importar:
        return []

    movimentos: list[MovimentoPlano] = []
    blocos = construir_blocos_consecutivos(dias_importar)
    primeiro_dia = min(dias_importar)

    if primeiro_dia > 1:
        dia_pre_periodo = date(ano, mes, 1) - timedelta(days=1)
        quando_saida_pre = datetime.combine(
            dia_pre_periodo,
            time(HORA_SAIDA_PRE_PERIODO[0], HORA_SAIDA_PRE_PERIODO[1]),
        )
        chave_pre = chave_movimento(convivente_id, "Saída", quando_saida_pre)
        if chave_pre not in chaves_existentes:
            movimentos.append(
                MovimentoPlano(
                    tipo_registro="Saída",
                    data_registro=quando_saida_pre,
                    observacao=f"{OBSERVACAO_IMPORT}; estabelece fora antes do periodo",
                    chave_idempotencia=chave_pre,
                )
            )

    for indice, (inicio_bloco, fim_bloco) in enumerate(blocos):
        quando_entrada = _datetime_dia(ano, mes, inicio_bloco, HORA_ENTRADA[0], HORA_ENTRADA[1])
        chave_entrada = chave_movimento(convivente_id, "Entrada", quando_entrada)
        if chave_entrada not in chaves_existentes:
            movimentos.append(
                MovimentoPlano(
                    tipo_registro="Entrada",
                    data_registro=quando_entrada,
                    observacao=OBSERVACAO_IMPORT,
                    chave_idempotencia=chave_entrada,
                )
            )

        ultimo_bloco = indice == len(blocos) - 1
        manter_dentro = (
            ultimo_bloco
            and presenca_dia_25
            and fim_bloco == dia_limite_importacao
            and respeitar_dentro_no_25
        )
        if manter_dentro:
            continue

        quando_saida = _datetime_dia(ano, mes, fim_bloco, HORA_SAIDA[0], HORA_SAIDA[1])
        chave_saida = chave_movimento(convivente_id, "Saída", quando_saida)
        if chave_saida not in chaves_existentes:
            movimentos.append(
                MovimentoPlano(
                    tipo_registro="Saída",
                    data_registro=quando_saida,
                    observacao=OBSERVACAO_IMPORT,
                    chave_idempotencia=chave_saida,
                )
            )

    return movimentos


def definir_status_final(
    *,
    presenca_dia_25: bool,
    ausencia_justificada_pdf: bool,
) -> tuple[str, bool]:
    if presenca_dia_25:
        return STATUS_ATIVO, False
    if ausencia_justificada_pdf:
        return STATUS_AJ, True
    return STATUS_INATIVADO, False


def pontuar_convivente_para_match(convivente) -> tuple[int, int, int]:
    """Maior pontuacao = melhor candidato em empate de SISA."""
    ativo = 1 if convivente.status in STATUS_VINCULACAO_ATIVA else 0
    completude = sum(
        bool(valor)
        for valor in (
            convivente.data_nascimento,
            convivente.data_entrada or convivente.data_inclusao,
            convivente.numero_sisa,
            convivente.nome_mae,
        )
    )
    prontuario = int(convivente.numero_institucional or 0)
    return (ativo, completude, prontuario)


def escolher_melhor_candidato_sisa(candidatos: list) -> tuple[object, str]:
    ordenados = sorted(
        candidatos,
        key=pontuar_convivente_para_match,
        reverse=True,
    )
    melhor = ordenados[0]
    if len(ordenados) > 1 and pontuar_convivente_para_match(melhor) == pontuar_convivente_para_match(
        ordenados[1]
    ):
        return None, "sisa_ambiguo"
    return melhor, "sisa_exato_desambiguado"


def precisa_retroagir_datas(
    data_inclusao: date | None,
    data_entrada: date | None,
    data_vinculacao_alvo: date,
) -> bool:
    for valor in (data_inclusao, data_entrada):
        if valor is None:
            continue
        if valor > data_vinculacao_alvo:
            return True
    return data_inclusao is None or data_entrada is None
