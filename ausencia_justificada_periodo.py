"""Períodos de ausência justificada (histórico) para presença operacional."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import AusenciaJustificadaPeriodoDB
from time_operacional import agora_operacional_naive


def normalizar_intervalo_periodo(
    data_inicio: date | None,
    data_fim: date,
) -> tuple[date, date]:
    inicio = data_inicio or data_fim
    if inicio > data_fim:
        inicio = data_fim
    return inicio, data_fim


def _coagir_data(valor: date | datetime | str | None) -> date | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()
    if not texto:
        return None
    return datetime.fromisoformat(texto.replace("Z", "+00:00")[:19]).date()


def dia_em_periodos_fechados(
    dia: date,
    periodos: Sequence[tuple[date, date]] | None,
) -> bool:
    for inicio_raw, fim_raw in periodos or ():
        inicio = _coagir_data(inicio_raw)
        fim = _coagir_data(fim_raw)
        if inicio is None or fim is None:
            continue
        if inicio <= dia <= fim:
            return True
    return False


def dia_tem_ausencia_justificada(
    dia: date,
    *,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
    periodos_fechados: Sequence[tuple[date, date]] | None = None,
) -> bool:
    """Dia coberto por AJ aberta (status atual) ou por período já encerrado."""
    if status_convivente == "Ausência justificada":
        if ausencia_justificada_desde is None or dia >= ausencia_justificada_desde:
            return True
    return dia_em_periodos_fechados(dia, periodos_fechados)


def expandir_dias_justificados(
    data_inicio: date,
    data_fim: date,
    *,
    status_convivente: str,
    ausencia_justificada_desde: date | None,
    periodos_fechados: Sequence[tuple[date, date]] | None = None,
) -> set[str]:
    dias: set[str] = set()
    dia = data_inicio
    while dia <= data_fim:
        if dia_tem_ausencia_justificada(
            dia,
            status_convivente=status_convivente,
            ausencia_justificada_desde=ausencia_justificada_desde,
            periodos_fechados=periodos_fechados,
        ):
            dias.add(dia.isoformat())
        dia += timedelta(days=1)
    return dias


def agrupar_periodos_por_convivente(
    periodos: Iterable[AusenciaJustificadaPeriodoDB],
) -> dict[str, list[tuple[date, date]]]:
    agrupado: dict[str, list[tuple[date, date]]] = {}
    for periodo in periodos:
        lista = agrupado.setdefault(periodo.convivente_id, [])
        lista.append((periodo.data_inicio, periodo.data_fim))
    return agrupado


async def carregar_periodos_ausencia_justificada(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_ids: Sequence[str],
    data_inicio: date | None = None,
    data_fim: date | None = None,
) -> dict[str, list[tuple[date, date]]]:
    if not convivente_ids:
        return {}

    filtros = [
        AusenciaJustificadaPeriodoDB.instituicao_id == instituicao_id,
        AusenciaJustificadaPeriodoDB.convivente_id.in_(list(convivente_ids)),
    ]
    if data_inicio is not None:
        filtros.append(AusenciaJustificadaPeriodoDB.data_fim >= data_inicio)
    if data_fim is not None:
        filtros.append(AusenciaJustificadaPeriodoDB.data_inicio <= data_fim)

    resultado = await db.execute(select(AusenciaJustificadaPeriodoDB).where(*filtros))
    return agrupar_periodos_por_convivente(resultado.scalars().all())


async def registrar_periodo_ausencia_justificada_encerrada(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    data_inicio: date | None,
    data_fim: date,
    usuario_id: str | None = None,
    origem_encerramento: str | None = None,
) -> AusenciaJustificadaPeriodoDB | None:
    """Persiste o intervalo AJ ao sair do status (Ativo/Inativado/etc.)."""
    inicio, fim = normalizar_intervalo_periodo(data_inicio, data_fim)

    existente = (
        await db.execute(
            select(AusenciaJustificadaPeriodoDB).where(
                AusenciaJustificadaPeriodoDB.instituicao_id == instituicao_id,
                AusenciaJustificadaPeriodoDB.convivente_id == convivente_id,
                AusenciaJustificadaPeriodoDB.data_inicio == inicio,
                AusenciaJustificadaPeriodoDB.data_fim == fim,
            )
        )
    ).scalar_one_or_none()
    if existente:
        return existente

    registro = AusenciaJustificadaPeriodoDB(
        instituicao_id=instituicao_id,
        convivente_id=convivente_id,
        data_inicio=inicio,
        data_fim=fim,
        usuario_id=usuario_id,
        origem_encerramento=(origem_encerramento or "").strip() or None,
        criado_em=agora_operacional_naive(),
    )
    db.add(registro)
    return registro
