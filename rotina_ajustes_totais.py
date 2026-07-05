"""Ajustes manuais de totais diários da rotina (camada estatística institucional)."""
from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import RegistroRotinaDB, RotinaAjusteDiarioDB, SisaImportacaoDB
from time_operacional import agora_operacional_naive, parse_data_filtro_operacional

TIPOS_AJUSTE_TOTAIS_ROTINA: tuple[str, ...] = (
    "Entrada",
    "Saída",
    "Café da manhã",
    "Almoço",
    "Jantar",
    "Lanche noturno",
    "Banho",
)

TIPOS_AJUSTE_TOTAIS_SET = frozenset(TIPOS_AJUSTE_TOTAIS_ROTINA)

JUSTIFICATIVA_AJUSTE_MIN_CHARS = 30


def data_operacional_hoje() -> date:
    return agora_operacional_naive().date()


def validar_data_ajuste_permitida(data_referencia: date) -> None:
    hoje = data_operacional_hoje()
    if data_referencia >= hoje:
        raise ValueError("Só é possível ajustar dias já encerrados (anteriores a hoje).")


async def mes_tem_importacao_sisa(
    db: AsyncSession,
    instituicao_id: str,
    data_referencia: date,
) -> bool:
    resultado = await db.execute(
        select(SisaImportacaoDB.id)
        .where(
            SisaImportacaoDB.instituicao_id == instituicao_id,
            extract("year", SisaImportacaoDB.data_referencia) == data_referencia.year,
            extract("month", SisaImportacaoDB.data_referencia) == data_referencia.month,
        )
        .limit(1)
    )
    return resultado.scalar_one_or_none() is not None


async def contar_registrados_por_tipo_dia(
    db: AsyncSession,
    instituicao_id: str,
    data_referencia: date,
    tipos_ajuste: tuple[str, ...] | None = None,
) -> dict[str, int]:
    tipos = tipos_ajuste or TIPOS_AJUSTE_TOTAIS_ROTINA
    inicio = parse_data_filtro_operacional(data_referencia.isoformat())
    fim = parse_data_filtro_operacional(data_referencia.isoformat(), fim_do_dia=True)
    linhas = (
        await db.execute(
            select(
                RegistroRotinaDB.tipo_registro,
                func.count(RegistroRotinaDB.id),
            )
            .where(
                RegistroRotinaDB.instituicao_id == instituicao_id,
                RegistroRotinaDB.cancelado != True,  # noqa: E712
                RegistroRotinaDB.data_registro >= inicio,
                RegistroRotinaDB.data_registro <= fim,
                RegistroRotinaDB.tipo_registro.in_(tipos),
            )
            .group_by(RegistroRotinaDB.tipo_registro)
        )
    ).all()
    return {tipo: int(qtd or 0) for tipo, qtd in linhas}


async def obter_ajustes_por_tipo_dia(
    db: AsyncSession,
    instituicao_id: str,
    data_referencia: date,
) -> dict[str, RotinaAjusteDiarioDB]:
    registros = (
        await db.execute(
            select(RotinaAjusteDiarioDB).where(
                RotinaAjusteDiarioDB.instituicao_id == instituicao_id,
                RotinaAjusteDiarioDB.data_referencia == data_referencia,
            )
        )
    ).scalars().all()
    return {registro.tipo_registro: registro for registro in registros}


async def montar_itens_painel_dia(
    db: AsyncSession,
    instituicao_id: str,
    data_referencia: date,
    tipos_ajuste: tuple[str, ...] | None = None,
) -> list[dict]:
    tipos = tipos_ajuste or TIPOS_AJUSTE_TOTAIS_ROTINA
    registrados = await contar_registrados_por_tipo_dia(
        db, instituicao_id, data_referencia, tipos_ajuste=tipos
    )
    ajustes = await obter_ajustes_por_tipo_dia(db, instituicao_id, data_referencia)
    itens: list[dict] = []

    for tipo in tipos:
        registrado = int(registrados.get(tipo, 0))
        ajuste_registro = ajustes.get(tipo)
        ajuste = int(ajuste_registro.quantidade_ajuste if ajuste_registro else 0)
        itens.append(
            {
                "tipo_registro": tipo,
                "registrados": registrado,
                "ajuste_manual": ajuste,
                "total_exibido": registrado + ajuste,
                "ajuste_id": ajuste_registro.id if ajuste_registro else None,
            }
        )

    return itens


async def obter_ajustes_agregados_periodo(
    db: AsyncSession,
    instituicao_id: str,
    data_inicio: date,
    data_fim: date,
) -> dict[str, dict[str, int]]:
    linhas = (
        await db.execute(
            select(
                RotinaAjusteDiarioDB.data_referencia,
                RotinaAjusteDiarioDB.tipo_registro,
                RotinaAjusteDiarioDB.quantidade_ajuste,
            )
            .where(
                RotinaAjusteDiarioDB.instituicao_id == instituicao_id,
                RotinaAjusteDiarioDB.data_referencia >= data_inicio,
                RotinaAjusteDiarioDB.data_referencia <= data_fim,
                RotinaAjusteDiarioDB.quantidade_ajuste > 0,
            )
        )
    ).all()

    por_dia: dict[str, dict[str, int]] = {}
    for data_ref, tipo, quantidade in linhas:
        chave = data_ref.isoformat()
        bucket = por_dia.setdefault(chave, {})
        bucket[tipo] = int(quantidade or 0)

    return por_dia


def _mapear_ajustes_resumo_evolucao(ajustes_dia: dict[str, int]) -> dict[str, int]:
    entradas = int(ajustes_dia.get("Entrada", 0))
    saidas = int(ajustes_dia.get("Saída", 0))
    refeicoes = sum(
        int(ajustes_dia.get(tipo, 0))
        for tipo in ("Café da manhã", "Almoço", "Jantar", "Lanche noturno")
    )
    banhos = int(ajustes_dia.get("Banho", 0))
    atendimentos = entradas + saidas + refeicoes + banhos
    return {
        "ajuste_entradas": entradas,
        "ajuste_saidas": saidas,
        "ajuste_refeicoes": refeicoes,
        "ajuste_banhos": banhos,
        "ajuste_atendimentos": atendimentos,
        "tem_ajuste_manual": atendimentos > 0,
    }


def enriquecer_resumo_evolucao_com_ajustes(
    resumo: list[dict],
    ajustes_por_dia: dict[str, dict[str, int]],
) -> list[dict]:
    enriquecido: list[dict] = []
    dias_vistos = set()

    for item in resumo:
        data_valor = item.get("data")
        if hasattr(data_valor, "isoformat"):
            chave = data_valor.isoformat()
        else:
            chave = str(data_valor)
        dias_vistos.add(chave)
        ajustes_dia = ajustes_por_dia.get(chave, {})
        ajustes_resumo = _mapear_ajustes_resumo_evolucao(ajustes_dia)
        entradas = int(item.get("entradas") or 0)
        saidas = int(item.get("saidas") or 0)
        almocos = int(item.get("almocos") or 0)
        atendimentos = int(item.get("atendimentos") or 0)
        enriquecido.append(
            {
                **item,
                **ajustes_resumo,
                "entradas_total": entradas + ajustes_resumo["ajuste_entradas"],
                "saidas_total": saidas + ajustes_resumo["ajuste_saidas"],
                "almocos_total": almocos + ajustes_resumo["ajuste_refeicoes"],
                "atendimentos_total": atendimentos + ajustes_resumo["ajuste_atendimentos"],
            }
        )

    for chave, ajustes_dia in sorted(ajustes_por_dia.items()):
        if chave in dias_vistos:
            continue
        ajustes_resumo = _mapear_ajustes_resumo_evolucao(ajustes_dia)
        if not ajustes_resumo["tem_ajuste_manual"]:
            continue
        enriquecido.append(
            {
                "data": chave,
                "atendimentos": 0,
                "entradas": 0,
                "saidas": 0,
                "almocos": 0,
                **ajustes_resumo,
                "entradas_total": ajustes_resumo["ajuste_entradas"],
                "saidas_total": ajustes_resumo["ajuste_saidas"],
                "almocos_total": ajustes_resumo["ajuste_refeicoes"],
                "atendimentos_total": ajustes_resumo["ajuste_atendimentos"],
            }
        )

    enriquecido.sort(key=lambda item: str(item.get("data")))
    return enriquecido


def agregar_ajustes_periodo_por_tipo(
    ajustes_por_dia: dict[str, dict[str, int]],
) -> dict[str, int]:
    agregado: dict[str, int] = {}
    for ajustes_dia in ajustes_por_dia.values():
        for tipo, quantidade in ajustes_dia.items():
            agregado[tipo] = agregado.get(tipo, 0) + int(quantidade or 0)
    return agregado


def ajustes_aplicaveis_historico(
    *,
    status_registro: str | None,
    apenas_editados: bool,
    apenas_cancelados: bool,
    apenas_retorno_rapido: bool,
) -> bool:
    if apenas_editados or apenas_cancelados or apenas_retorno_rapido:
        return False
    if status_registro and status_registro.strip().lower() in {"cancelado", "cancelados"}:
        return False
    return True


def enriquecer_resumo_periodo_historico(
    resumo_periodo: dict,
    ajustes_por_tipo: dict[str, int],
    *,
    tipo_registro_filtro: str | None = None,
) -> dict:
    if not ajustes_por_tipo:
        return {
            **resumo_periodo,
            "tem_ajuste_manual": False,
            "total_complemento_ajuste": 0,
            "ajustes_por_tipo": {},
        }

    if tipo_registro_filtro:
        ajustes_aplicar = {
            tipo_registro_filtro: int(ajustes_por_tipo.get(tipo_registro_filtro, 0)),
        }
        if ajustes_aplicar[tipo_registro_filtro] <= 0:
            ajustes_aplicar = {}
    else:
        ajustes_aplicar = {
            tipo: int(quantidade)
            for tipo, quantidade in ajustes_por_tipo.items()
            if int(quantidade or 0) > 0
        }

    total_complemento = sum(ajustes_aplicar.values())
    if total_complemento <= 0:
        return {
            **resumo_periodo,
            "tem_ajuste_manual": False,
            "total_complemento_ajuste": 0,
            "ajustes_por_tipo": {},
        }

    enriquecido = dict(resumo_periodo)
    enriquecido["total_registrado"] = int(enriquecido.get("total", 0))
    enriquecido["entradas_registradas"] = int(enriquecido.get("entradas", 0))
    enriquecido["saidas_registradas"] = int(enriquecido.get("saidas", 0))

    contagens = {
        str(tipo): int(quantidade)
        for tipo, quantidade in (enriquecido.get("contagens_por_tipo") or {}).items()
    }
    for tipo, quantidade in ajustes_aplicar.items():
        contagens[tipo] = int(contagens.get(tipo, 0)) + int(quantidade)

    enriquecido["contagens_por_tipo"] = contagens
    enriquecido["total"] = int(enriquecido["total_registrado"]) + total_complemento
    enriquecido["entradas"] = int(enriquecido["entradas_registradas"]) + int(
        ajustes_aplicar.get("Entrada", 0)
    )
    enriquecido["saidas"] = int(enriquecido["saidas_registradas"]) + int(
        ajustes_aplicar.get("Saída", 0)
    )
    enriquecido["tem_ajuste_manual"] = True
    enriquecido["total_complemento_ajuste"] = total_complemento
    enriquecido["ajustes_por_tipo"] = ajustes_aplicar
    return enriquecido
