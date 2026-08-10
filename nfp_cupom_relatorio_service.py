"""Relatorio operacional de cupons NFP (lidos / fila / enviados)."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import NfpCupomLidoDB
from nfp_utils import normalizar_agente_captacao
from time_operacional import parse_data_filtro_operacional

STATUS_VALIDOS = (
    "checando",
    "pendente",
    "reservado",
    "enviado",
    "erro",
    "rejeitado_cpf",
)

EIXOS_DATA = ("lido_em", "enviado_em")
LIMITE_DETALHE_PADRAO = 50
LIMITE_DETALHE_MAX = 200
LIMITE_EXPORT_MAX = 2000


def _parse_status_csv(status: Optional[str]) -> list[str]:
    if not status or not str(status).strip():
        return []
    out: list[str] = []
    for parte in str(status).split(","):
        s = parte.strip().lower()
        if s in STATUS_VALIDOS and s not in out:
            out.append(s)
    return out


def _fmt_dt(valor) -> Optional[str]:
    if not valor:
        return None
    try:
        return valor.isoformat(sep=" ", timespec="seconds")
    except Exception:
        return str(valor)


def _montar_filtros(
    *,
    organizacao_id: str,
    coluna_data,
    inicio,
    fim,
    captador_sel: Optional[str],
    status_sel: list[str],
    busca: Optional[str],
) -> list:
    filtros = [NfpCupomLidoDB.organizacao_id == organizacao_id]
    if inicio is not None:
        filtros.append(coluna_data >= inicio)
    if fim is not None:
        filtros.append(coluna_data <= fim)
    if captador_sel:
        filtros.append(NfpCupomLidoDB.captador == captador_sel)
    if status_sel:
        filtros.append(NfpCupomLidoDB.status.in_(status_sel))
    if busca and str(busca).strip():
        termo = f"%{str(busca).strip()}%"
        filtros.append(
            (NfpCupomLidoDB.chave.ilike(termo))
            | (NfpCupomLidoDB.cnpj_emitente.ilike(termo))
            | (NfpCupomLidoDB.mensagem.ilike(termo))
        )
    return filtros


async def relatorio_cupons(
    db: AsyncSession,
    organizacao_id: str,
    *,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    captador: Optional[str] = None,
    status: Optional[str] = None,
    busca: Optional[str] = None,
    eixo_data: str = "lido_em",
    limite: int = LIMITE_DETALHE_PADRAO,
    offset: int = 0,
    incluir_agregados: bool = True,
    exportacao: bool = False,
) -> dict[str, Any]:
    """Consolida cupons por periodo (SP). Detalhe sempre paginado."""
    eixo = (eixo_data or "lido_em").strip().lower()
    if eixo not in EIXOS_DATA:
        raise ValueError("eixo_data invalido. Use lido_em ou enviado_em.")

    coluna_data = NfpCupomLidoDB.lido_em if eixo == "lido_em" else NfpCupomLidoDB.enviado_em
    try:
        inicio = parse_data_filtro_operacional(data_inicio, fim_do_dia=False) if data_inicio else None
        fim = parse_data_filtro_operacional(data_fim, fim_do_dia=True) if data_fim else None
    except ValueError as exc:
        raise ValueError("Data invalida. Use AAAA-MM-DD.") from exc
    if data_inicio and inicio is None:
        raise ValueError("data_inicio invalida. Use AAAA-MM-DD.")
    if data_fim and fim is None:
        raise ValueError("data_fim invalida. Use AAAA-MM-DD.")
    if inicio and fim and inicio > fim:
        raise ValueError("data_inicio nao pode ser posterior a data_fim.")

    captador_sel = normalizar_agente_captacao(captador) if captador else None
    status_sel = _parse_status_csv(status)
    offset_n = max(0, int(offset or 0))
    max_lim = LIMITE_EXPORT_MAX if exportacao else LIMITE_DETALHE_MAX
    default_lim = LIMITE_EXPORT_MAX if exportacao else LIMITE_DETALHE_PADRAO
    limite_n = max(1, min(int(limite or default_lim), max_lim))

    filtros = _montar_filtros(
        organizacao_id=organizacao_id,
        coluna_data=coluna_data,
        inicio=inicio,
        fim=fim,
        captador_sel=captador_sel,
        status_sel=status_sel,
        busca=busca,
    )

    totais = None
    por_captador: list[dict[str, Any]] = []
    por_status: list[dict[str, Any]] = []
    captadores: list[str] = []
    total_lidos = 0

    if incluir_agregados:
        q_totais = (
            select(NfpCupomLidoDB.status, func.count())
            .where(*filtros)
            .group_by(NfpCupomLidoDB.status)
        )
        rows_totais = (await db.execute(q_totais)).all()
        contagem = Counter({str(st or ""): int(qtd or 0) for st, qtd in rows_totais})
        total_lidos = sum(contagem.values())
        totais = {
            "lidos": total_lidos,
            "checando": int(contagem.get("checando", 0)),
            "pendentes": int(contagem.get("pendente", 0)),
            "reservados": int(contagem.get("reservado", 0)),
            "enviados": int(contagem.get("enviado", 0)),
            "erros": int(contagem.get("erro", 0)),
            "rejeitados_cpf": int(contagem.get("rejeitado_cpf", 0)),
        }

        q_cap = (
            select(NfpCupomLidoDB.captador, NfpCupomLidoDB.status, func.count())
            .where(*filtros)
            .group_by(NfpCupomLidoDB.captador, NfpCupomLidoDB.status)
        )
        rows_cap = (await db.execute(q_cap)).all()
        por_captador_map: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "captador": "",
                "lidos": 0,
                "checando": 0,
                "pendentes": 0,
                "reservados": 0,
                "enviados": 0,
                "erros": 0,
                "rejeitados_cpf": 0,
            }
        )
        for cap, st, qtd in rows_cap:
            chave = normalizar_agente_captacao(cap) or "SEM_CAPTADOR"
            bucket = por_captador_map[chave]
            bucket["captador"] = chave
            n = int(qtd or 0)
            bucket["lidos"] += n
            if st == "checando":
                bucket["checando"] += n
            elif st == "pendente":
                bucket["pendentes"] += n
            elif st == "reservado":
                bucket["reservados"] += n
            elif st == "enviado":
                bucket["enviados"] += n
            elif st == "erro":
                bucket["erros"] += n
            elif st == "rejeitado_cpf":
                bucket["rejeitados_cpf"] += n

        por_captador = sorted(
            por_captador_map.values(),
            key=lambda x: (-int(x["lidos"]), x["captador"]),
        )
        por_status = [
            {"status": st, "qtd": int(contagem.get(st, 0))}
            for st in STATUS_VALIDOS
            if contagem.get(st, 0)
        ]
        for st, qtd in sorted(contagem.items()):
            if st not in STATUS_VALIDOS and qtd:
                por_status.append({"status": st, "qtd": int(qtd)})

        caps_org = (
            await db.execute(
                select(NfpCupomLidoDB.captador)
                .where(NfpCupomLidoDB.organizacao_id == organizacao_id)
                .distinct()
                .order_by(NfpCupomLidoDB.captador)
                .limit(200)
            )
        ).scalars().all()
        captadores = [
            normalizar_agente_captacao(c) for c in caps_org if normalizar_agente_captacao(c)
        ]
    else:
        total_lidos = int(
            (
                await db.execute(select(func.count()).select_from(NfpCupomLidoDB).where(*filtros))
            ).scalar_one()
            or 0
        )

    q_linhas = (
        select(NfpCupomLidoDB)
        .where(*filtros)
        .order_by(coluna_data.desc(), NfpCupomLidoDB.criado_em.desc())
        .offset(offset_n)
        .limit(limite_n)
    )
    rows = (await db.execute(q_linhas)).scalars().all()
    linhas = [
        {
            "id": r.id,
            "chave": r.chave,
            "captador": r.captador,
            "status": r.status,
            "cnpj_emitente": r.cnpj_emitente,
            "data_emissao_ref": r.data_emissao_ref,
            "consumidor_identificado": r.consumidor_identificado,
            "mensagem": r.mensagem,
            "lido_em": _fmt_dt(r.lido_em),
            "enviado_em": _fmt_dt(r.enviado_em),
            "reservado_por": r.reservado_por,
        }
        for r in rows
    ]

    return {
        "filtros": {
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "captador": captador_sel,
            "status": status_sel or None,
            "busca": (str(busca).strip() if busca else None) or None,
            "eixo_data": eixo,
            "limite": limite_n,
            "offset": offset_n,
        },
        "totais": totais,
        "por_captador": por_captador,
        "por_status": por_status,
        "linhas": linhas,
        "paginacao": {
            "offset": offset_n,
            "limite": limite_n,
            "total": total_lidos,
            "pagina": (offset_n // limite_n) + 1 if limite_n else 1,
            "total_paginas": max(1, (total_lidos + limite_n - 1) // limite_n) if limite_n else 1,
        },
        "linhas_truncadas": total_lidos > (offset_n + len(linhas)),
        "captadores": captadores,
        "status_disponiveis": list(STATUS_VALIDOS),
    }
