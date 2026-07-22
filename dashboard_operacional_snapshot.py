"""Snapshots diários do Dashboard Operacional (22:00 America/Sao_Paulo)."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DashboardOperacionalSnapshotDB, InstituicaoDB
from time_operacional import agora_operacional_naive

logger = logging.getLogger("carecore.dashboard_operacional_snapshot")

HORA_CAPTURA = 22
TIPOS_FLUXO = frozenset({"Entrada", "Saída"})
PREFIXO_INTERACAO = "interacao:"

METRICAS_GRAFICO = (
    "dentro_projeto",
    "fora_projeto",
    "conviventes_ativos",
    "sem_interacao_24h",
    "ausentes_operacionais",
    "total_interacoes_hoje",
    "total_registros_hoje",
    "retornos_rapidos_hoje",
    "cancelados_hoje",
    "editados_hoje",
)

# Cobertas por interacao:<tipo> — não listar de novo nos filtros.
METRICAS_REDUNDANTES_COM_INTERACAO = frozenset({
    "entradas_hoje",
    "saidas_hoje",
    "cafes_hoje",
    "almocos_hoje",
    "jantares_hoje",
    "lanches_noturnos_hoje",
})

# Visão inicial: só as três séries pedidas pelo operacional.
METRICAS_PADRAO_GRAFICO = (
    "dentro_projeto",
    "fora_projeto",
    "total_interacoes_hoje",
)

# Ordem operacional dos filtros (fluxo, alimentação e enxoval agrupados).
ORDEM_METRICAS_BASE = (
    "dentro_projeto",
    "fora_projeto",
    "conviventes_ativos",
    "total_interacoes_hoje",
    "total_registros_hoje",
)

ORDEM_TIPOS_INTERACAO = (
    "Entrada",
    "Saída",
    "Café da manhã",
    "Almoço",
    "Jantar",
    "Lanche noturno",
    "Banho",
    "Banheiro / Ducha",
    "Retirada de Cobertor",
    "Entrega de Cobertor",
    "Retirada de Toalha",
    "Entrega de Toalha",
    "Movimentação de Bagageiro",
    "Bipar documentos guardados",
    "Bipar documentos retirados",
)

ORDEM_METRICAS_FINAIS = (
    "sem_interacao_24h",
    "ausentes_operacionais",
    "retornos_rapidos_hoje",
    "cancelados_hoje",
    "editados_hoje",
)


def total_interacoes_sem_fluxo(interacoes: dict | None) -> int:
    """Interações do dia sem Entrada/Saída (fluxo fica em entradas/saídas)."""
    return sum(
        int(v or 0)
        for tipo, v in (interacoes or {}).items()
        if tipo not in TIPOS_FLUXO
    )


def chave_metrica_interacao(tipo: str) -> str:
    return f"{PREFIXO_INTERACAO}{tipo}"


def valor_metrica_item(item: dict, chave: str) -> int:
    resumo = item.get("resumo") or {}
    interacoes = item.get("interacoes_hoje") or {}

    if chave == "total_interacoes_hoje":
        return total_interacoes_sem_fluxo(interacoes)

    if chave == "total_registros_hoje":
        if resumo.get("total_registros_hoje") is not None:
            return int(resumo.get("total_registros_hoje") or 0)
        return sum(int(v or 0) for v in interacoes.values())

    if chave.startswith(PREFIXO_INTERACAO):
        tipo = chave[len(PREFIXO_INTERACAO):]
        return int(interacoes.get(tipo) or 0)

    # Compat: aliases antigos apontam para o tipo de interação.
    alias_tipo = {
        "entradas_hoje": "Entrada",
        "saidas_hoje": "Saída",
        "cafes_hoje": "Café da manhã",
        "almocos_hoje": "Almoço",
        "jantares_hoje": "Jantar",
        "lanches_noturnos_hoje": "Lanche noturno",
    }
    if chave in alias_tipo:
        tipo = alias_tipo[chave]
        if tipo in interacoes:
            return int(interacoes.get(tipo) or 0)
        return int(resumo.get(chave) or 0)

    return int(resumo.get(chave) or 0)


def _prioridade_metrica(chave: str) -> tuple:
    if chave in ORDEM_METRICAS_BASE:
        return (0, ORDEM_METRICAS_BASE.index(chave), "")

    if chave.startswith(PREFIXO_INTERACAO):
        tipo = chave[len(PREFIXO_INTERACAO):]
        if tipo in ORDEM_TIPOS_INTERACAO:
            return (1, ORDEM_TIPOS_INTERACAO.index(tipo), "")
        return (2, 0, tipo.casefold())

    if chave in ORDEM_METRICAS_FINAIS:
        return (3, ORDEM_METRICAS_FINAIS.index(chave), "")

    return (4, 0, chave.casefold())


def ordenar_metricas_disponiveis(metricas: list[str] | tuple[str, ...]) -> list[str]:
    unicas: list[str] = []
    vistas: set[str] = set()
    for chave in metricas:
        if chave in vistas:
            continue
        vistas.add(chave)
        unicas.append(chave)
    return sorted(unicas, key=_prioridade_metrica)


def coletar_metricas_disponiveis(items: list[dict]) -> list[str]:
    """Métricas de estado/totais + tipos de interação, em ordem operacional."""
    metricas = [m for m in METRICAS_GRAFICO if m not in METRICAS_REDUNDANTES_COM_INTERACAO]
    tipos: set[str] = set()
    for item in items:
        tipos.update((item.get("interacoes_hoje") or {}).keys())
    for tipo in tipos:
        chave = chave_metrica_interacao(tipo)
        if chave not in metricas:
            metricas.append(chave)
    return ordenar_metricas_disponiveis(metricas)


def _json_default(valor: Any):
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return str(valor)


def extrair_retrato_para_snapshot(payload: dict) -> dict:
    """Guarda totais/alertas/interações — sem listas nominais grandes."""
    resumo = dict(payload.get("resumo") or {})
    interacoes_hoje = dict(payload.get("interacoes_hoje") or {})
    resumo["total_interacoes_hoje"] = total_interacoes_sem_fluxo(interacoes_hoje)
    if resumo.get("total_registros_hoje") is None:
        resumo["total_registros_hoje"] = sum(int(v or 0) for v in interacoes_hoje.values())
    return {
        "data_referencia": payload.get("data_referencia"),
        "atualizado_em": payload.get("atualizado_em"),
        "resumo": resumo,
        "interacoes_hoje": interacoes_hoje,
        "listas_totais": dict(payload.get("listas_totais") or {}),
        "alertas": list(payload.get("alertas") or []),
    }


async def snapshot_existe(
    db: AsyncSession,
    *,
    instituicao_id: str,
    data_referencia: date,
) -> bool:
    existente = (
        await db.execute(
            select(DashboardOperacionalSnapshotDB.id).where(
                DashboardOperacionalSnapshotDB.instituicao_id == instituicao_id,
                DashboardOperacionalSnapshotDB.data_referencia == data_referencia,
            ).limit(1)
        )
    ).scalar_one_or_none()
    return existente is not None


async def salvar_snapshot_se_ausente(
    db: AsyncSession,
    *,
    instituicao_id: str,
    payload: dict,
    capturado_em: datetime | None = None,
) -> DashboardOperacionalSnapshotDB | None:
    capturado_em = capturado_em or agora_operacional_naive()
    data_ref = date.fromisoformat(str(payload.get("data_referencia") or capturado_em.date().isoformat()))

    if await snapshot_existe(db, instituicao_id=instituicao_id, data_referencia=data_ref):
        return None

    retrato = extrair_retrato_para_snapshot(payload)
    registro = DashboardOperacionalSnapshotDB(
        instituicao_id=instituicao_id,
        data_referencia=data_ref,
        capturado_em=capturado_em,
        payload_json=json.dumps(retrato, ensure_ascii=False, default=_json_default),
    )
    db.add(registro)
    await db.commit()
    await db.refresh(registro)
    logger.info(
        "Snapshot dashboard operacional salvo instituicao=%s data=%s",
        instituicao_id,
        data_ref.isoformat(),
    )
    return registro


async def garantir_snapshot_apos_22h(
    db: AsyncSession,
    instituicao_id: str,
    payload: dict | None = None,
) -> DashboardOperacionalSnapshotDB | None:
    """Se já passou das 22:00 SP e não há retrato do dia, captura agora."""
    agora = agora_operacional_naive()
    if agora.hour < HORA_CAPTURA:
        return None

    data_ref = agora.date()
    if await snapshot_existe(db, instituicao_id=instituicao_id, data_referencia=data_ref):
        return None

    if payload is None:
        from routers.conviventes import montar_dashboard_operacional_payload

        payload = await montar_dashboard_operacional_payload(
            db,
            instituicao_id,
            limite_listas=20,
            agora=agora,
        )

    return await salvar_snapshot_se_ausente(
        db,
        instituicao_id=instituicao_id,
        payload=payload,
        capturado_em=agora,
    )


async def capturar_snapshots_pendentes_todas_instituicoes(
    db: AsyncSession,
    *,
    forcar: bool = False,
) -> dict:
    """Job das 22:00: grava um retrato por instituição se ainda não existir no dia."""
    agora = agora_operacional_naive()
    if (not forcar) and agora.hour < HORA_CAPTURA:
        return {
            "status": "fora_horario",
            "hora": agora.hour,
            "capturados": 0,
            "ja_existiam": 0,
            "instituicoes": 0,
        }

    capturado_em = agora
    if agora.hour < HORA_CAPTURA:
        # Forçar fora do horário: usa o instante atual (manutenção).
        pass
    else:
        # Normaliza o carimbo para ~22:00 do dia operacional.
        capturado_em = datetime.combine(
            agora.date(),
            datetime.min.time().replace(hour=HORA_CAPTURA, minute=0),
        )
        if agora < capturado_em:
            capturado_em = agora

    instituicoes = (
        await db.execute(select(InstituicaoDB.id))
    ).scalars().all()

    capturados = 0
    ja_existiam = 0
    for instituicao_id in instituicoes:
        if await snapshot_existe(db, instituicao_id=instituicao_id, data_referencia=agora.date()):
            ja_existiam += 1
            continue
        from routers.conviventes import montar_dashboard_operacional_payload

        payload = await montar_dashboard_operacional_payload(
            db,
            instituicao_id,
            limite_listas=20,
            agora=capturado_em if capturado_em.hour >= HORA_CAPTURA else agora,
        )
        registro = await salvar_snapshot_se_ausente(
            db,
            instituicao_id=instituicao_id,
            payload=payload,
            capturado_em=agora,
        )
        if registro:
            capturados += 1

    return {
        "status": "ok",
        "hora": agora.hour,
        "capturados": capturados,
        "ja_existiam": ja_existiam,
        "instituicoes": len(instituicoes),
        "data_referencia": agora.date().isoformat(),
        "forcado": forcar,
    }


async def backfill_snapshots_periodo(
    db: AsyncSession,
    *,
    data_inicio: date,
    data_fim: date,
    instituicao_id: str | None = None,
) -> dict:
    """
    Reconstrói retratos 22:00 SP para dias passados (não sobrescreve existentes).
    Usa o estado operacional cortado às 22:00 de cada dia.
    """
    from routers.conviventes import montar_dashboard_operacional_payload

    if data_inicio > data_fim:
        raise ValueError("data_inicio deve ser anterior ou igual a data_fim")

    hoje = agora_operacional_naive().date()
    fim_efetivo = min(data_fim, hoje - timedelta(days=1)) if data_fim >= hoje else data_fim
    if fim_efetivo < data_inicio:
        return {
            "status": "sem_dias",
            "criados": 0,
            "ja_existiam": 0,
            "dias": 0,
            "instituicoes": 0,
        }

    if instituicao_id:
        instituicoes = [instituicao_id]
    else:
        instituicoes = (
            await db.execute(select(InstituicaoDB.id))
        ).scalars().all()

    criados = 0
    ja_existiam = 0
    dias = 0
    dia = data_inicio
    while dia <= fim_efetivo:
        dias += 1
        momento_22h = datetime.combine(
            dia,
            datetime.min.time().replace(hour=HORA_CAPTURA, minute=0),
        )
        for inst_id in instituicoes:
            if await snapshot_existe(db, instituicao_id=inst_id, data_referencia=dia):
                ja_existiam += 1
                continue
            payload = await montar_dashboard_operacional_payload(
                db,
                inst_id,
                limite_listas=20,
                agora=momento_22h,
            )
            registro = await salvar_snapshot_se_ausente(
                db,
                instituicao_id=inst_id,
                payload=payload,
                capturado_em=momento_22h,
            )
            if registro:
                criados += 1
        dia += timedelta(days=1)

    return {
        "status": "ok",
        "criados": criados,
        "ja_existiam": ja_existiam,
        "dias": dias,
        "instituicoes": len(instituicoes),
        "data_inicio": data_inicio.isoformat(),
        "data_fim": fim_efetivo.isoformat(),
        "reconstruido": True,
    }


def _parse_payload(registro: DashboardOperacionalSnapshotDB) -> dict:
    try:
        return json.loads(registro.payload_json or "{}")
    except json.JSONDecodeError:
        return {}


async def listar_snapshots(
    db: AsyncSession,
    *,
    instituicao_id: str,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    limite: int = 60,
) -> list[dict]:
    query = select(DashboardOperacionalSnapshotDB).where(
        DashboardOperacionalSnapshotDB.instituicao_id == instituicao_id,
    )
    if data_inicio:
        query = query.where(DashboardOperacionalSnapshotDB.data_referencia >= data_inicio)
    if data_fim:
        query = query.where(DashboardOperacionalSnapshotDB.data_referencia <= data_fim)

    registros = (
        await db.execute(
            query.order_by(DashboardOperacionalSnapshotDB.data_referencia.desc()).limit(limite)
        )
    ).scalars().all()

    items = []
    for registro in registros:
        payload = _parse_payload(registro)
        resumo = payload.get("resumo") or {}
        items.append(
            {
                "id": registro.id,
                "data_referencia": registro.data_referencia.isoformat(),
                "capturado_em": registro.capturado_em.isoformat() if registro.capturado_em else None,
                "resumo": resumo,
                "interacoes_hoje": payload.get("interacoes_hoje") or {},
                "listas_totais": payload.get("listas_totais") or {},
                "alertas": payload.get("alertas") or [],
            }
        )
    return items


async def obter_snapshot_por_data(
    db: AsyncSession,
    *,
    instituicao_id: str,
    data_referencia: date,
) -> dict | None:
    registro = (
        await db.execute(
            select(DashboardOperacionalSnapshotDB).where(
                DashboardOperacionalSnapshotDB.instituicao_id == instituicao_id,
                DashboardOperacionalSnapshotDB.data_referencia == data_referencia,
            )
        )
    ).scalar_one_or_none()
    if not registro:
        return None
    payload = _parse_payload(registro)
    return {
        "id": registro.id,
        "data_referencia": registro.data_referencia.isoformat(),
        "capturado_em": registro.capturado_em.isoformat() if registro.capturado_em else None,
        "resumo": payload.get("resumo") or {},
        "interacoes_hoje": payload.get("interacoes_hoje") or {},
        "listas_totais": payload.get("listas_totais") or {},
        "alertas": payload.get("alertas") or [],
    }


def montar_serie_grafico(items: list[dict], metrica: str) -> list[dict]:
    chave = metrica or "dentro_projeto"
    ordenados = sorted(items, key=lambda item: item.get("data_referencia") or "")
    return [
        {
            "data": item.get("data_referencia"),
            "valor": valor_metrica_item(item, chave),
            "metrica": chave,
        }
        for item in ordenados
    ]


def montar_series_grafico(
    items: list[dict],
    metricas: list[str] | tuple[str, ...] | None = None,
) -> dict[str, list[dict]]:
    """Várias séries. Se metricas for None, devolve todas (fixas + tipos do período)."""
    chaves = list(metricas) if metricas else coletar_metricas_disponiveis(items)
    if not chaves:
        chaves = list(METRICAS_PADRAO_GRAFICO)
    return {chave: montar_serie_grafico(items, chave) for chave in chaves}


def periodo_padrao_30_dias(hoje: date | None = None) -> tuple[date, date]:
    fim = hoje or agora_operacional_naive().date()
    inicio = fim - timedelta(days=29)
    return inicio, fim
