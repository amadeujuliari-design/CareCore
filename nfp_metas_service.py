"""Servico Metas NFP — persistencia e calculo (mapa JULHO 2026)."""

from __future__ import annotations

import io
from typing import Any, Optional

from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import NfpDoadorDB, NfpMetasCompetenciaDB, NfpMetasLinhaDB
from nfp_metas_utils import (
    PROJETOS_METAS_NFP,
    calcular_metas_julho,
    codigo_projeto_metas,
    ref_credito_padrao,
)
from nfp_service import resumo_dashboard
from time_operacional import agora_operacional_naive


def _float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _int(v: Any, default: int = 0) -> int:
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except (TypeError, ValueError):
        return default


async def contar_doadores_por_projeto(db: AsyncSession, organizacao_id: str) -> dict[str, int]:
    """Usa unidade_captador do cadastro de doadores como vinculo ao projeto."""
    rows = (
        await db.execute(
            select(NfpDoadorDB.unidade_captador, func.count())
            .where(
                NfpDoadorDB.organizacao_id == organizacao_id,
                NfpDoadorDB.ativo.is_(True),
            )
            .group_by(NfpDoadorDB.unidade_captador)
        )
    ).all()
    contagem = {p: 0 for p in PROJETOS_METAS_NFP}
    for unidade, qtd in rows:
        codigo = codigo_projeto_metas(unidade)
        if codigo in contagem:
            contagem[codigo] += int(qtd or 0)
    return contagem


async def _obter_ou_criar_competencia(
    db: AsyncSession,
    organizacao_id: str,
    competencia: str,
) -> NfpMetasCompetenciaDB:
    comp = (competencia or "").strip()
    if len(comp) != 7 or comp[4] != "-":
        raise ValueError("Competencia deve ser AAAA-MM.")

    row = (
        await db.execute(
            select(NfpMetasCompetenciaDB).where(
                NfpMetasCompetenciaDB.organizacao_id == organizacao_id,
                NfpMetasCompetenciaDB.competencia == comp,
            )
        )
    ).scalar_one_or_none()
    if row:
        return row

    agora = agora_operacional_naive()
    row = NfpMetasCompetenciaDB(
        organizacao_id=organizacao_id,
        competencia=comp,
        titulo=f"METAS NFP {comp}",
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(row)
    await db.flush()

    for i, projeto in enumerate(PROJETOS_METAS_NFP):
        db.add(
            NfpMetasLinhaDB(
                competencia_id=row.id,
                codigo_projeto=projeto,
                ordem=i + 1,
                atualizado_em=agora,
            )
        )
    await db.flush()
    return row


async def _linhas_comp(db: AsyncSession, competencia_id: str) -> list[NfpMetasLinhaDB]:
    rows = (
        await db.execute(
            select(NfpMetasLinhaDB)
            .where(NfpMetasLinhaDB.competencia_id == competencia_id)
            .order_by(NfpMetasLinhaDB.ordem, NfpMetasLinhaDB.codigo_projeto)
        )
    ).scalars().all()
    return list(rows)


def _aplicar_calculo(cab: NfpMetasCompetenciaDB, linhas: list[NfpMetasLinhaDB]):
    digitadas = {l.codigo_projeto: int(l.digitadas or 0) for l in linhas}
    doadas = {l.codigo_projeto: int(l.doadas or 0) for l in linhas}
    soulcial = {l.codigo_projeto: float(l.soulcial or 0) for l in linhas}
    campanhas = {l.codigo_projeto: float(l.soulcial_campanhas or 0) for l in linhas}

    resumo = calcular_metas_julho(
        digitadas_por_projeto=digitadas,
        doadas_por_projeto=doadas,
        soulcial_por_projeto=soulcial,
        campanhas_por_projeto=campanhas,
        f35_digitado=float(cab.f35_digitado or 0),
        f36_doado=float(cab.f36_doado or 0),
        soulcial_base=float(cab.soulcial_base or 0),
        total_captador=float(cab.total_captador or 0),
        digitadas_diego=int(cab.digitadas_diego or 0),
        pct_fundo=float(cab.pct_fundo or 0.3),
        pct_soulcial=float(cab.pct_soulcial or 0.2),
        pct_fundo_soulcial=float(cab.pct_fundo_soulcial or 0.1),
        pct_premiacao=float(cab.pct_premiacao or 0.1),
        pct_diego=float(cab.pct_diego or 0.5),
    )

    por_codigo = {l.codigo_projeto: l for l in resumo.linhas}
    for linha in linhas:
        calc = por_codigo.get(linha.codigo_projeto)
        if not calc:
            continue
        linha.pct_digitadas = calc.pct_digitadas
        linha.pct_doadas = calc.pct_doadas
        linha.valor_digitado = calc.valor_digitado
        linha.valor_aplicativo = calc.valor_aplicativo
        linha.valor_total = calc.valor_total
        linha.diego = calc.diego
        linha.total = calc.total
        linha.atualizado_em = agora_operacional_naive()
    return resumo


def serializar_metas(cab: NfpMetasCompetenciaDB, linhas: list[NfpMetasLinhaDB], resumo) -> dict:
    return {
        "id": cab.id,
        "competencia": cab.competencia,
        "ref_credito": cab.ref_credito,
        "titulo": cab.titulo,
        "status": cab.status,
        "parametros": {
            "pct_fundo": cab.pct_fundo,
            "pct_soulcial": cab.pct_soulcial,
            "pct_fundo_soulcial": cab.pct_fundo_soulcial,
            "pct_premiacao": cab.pct_premiacao,
            "pct_diego": cab.pct_diego,
        },
        "cabecalho": {
            "f35_digitado": cab.f35_digitado,
            "f36_doado": cab.f36_doado,
            "soulcial_base": cab.soulcial_base,
            "total_captador": cab.total_captador,
            "digitadas_diego": cab.digitadas_diego,
            "data_liberacao_credito": cab.data_liberacao_credito,
            "observacoes": cab.observacoes,
        },
        "calculado": {
            "g35_fundo": resumo.g35_fundo,
            "h35_projetos": resumo.h35_projetos,
            "g36_fundo": resumo.g36_fundo,
            "h36_projetos": resumo.h36_projetos,
            "f37_total": resumo.f37_total,
            "g37_fundo": resumo.g37_fundo,
            "h37_projetos": resumo.h37_projetos,
            "soulcial_20": resumo.soulcial_20,
            "fundo_10": resumo.fundo_10,
            "premiacao_10": resumo.premiacao_10,
            "soulcial_rateio": resumo.soulcial_rateio,
            "valor_diego": resumo.valor_diego,
            "total_geral_aeb": resumo.total_geral_aeb,
            "total_rateio_geral": resumo.total_rateio_geral,
            "valor_conquistado": resumo.valor_conquistado,
            "valor_aplicado": resumo.valor_aplicado,
            "batimento_diferenca": resumo.batimento_diferenca,
            "batimento_ok": resumo.batimento_ok,
            "digitadas_projetos": resumo.digitadas_projetos,
            "digitadas_geral": resumo.digitadas_geral,
        },
        "linhas": [
            {
                "id": l.id,
                "codigo_projeto": l.codigo_projeto,
                "ordem": l.ordem,
                "digitadas": l.digitadas,
                "pct_digitadas": l.pct_digitadas,
                "doadas": l.doadas,
                "pct_doadas": l.pct_doadas,
                "valor_digitado": l.valor_digitado,
                "valor_aplicativo": l.valor_aplicativo,
                "valor_total": l.valor_total,
                "soulcial": l.soulcial,
                "soulcial_campanhas": l.soulcial_campanhas,
                "diego": l.diego,
                "total": l.total,
            }
            for l in sorted(linhas, key=lambda x: (x.ordem, x.codigo_projeto))
        ],
        "mapa_campos": {
            "digitadas": "manual (Digitado) — Notabe/Nota do Bem ainda sem import",
            "doadas": "auto a partir do cadastro de doadores (unidade_captador) ou manual",
            "soulcial": "manual (Digitado)",
            "soulcial_campanhas": "manual (Digitado)",
            "f35_digitado": "automatico do rateio NFP (editavel)",
            "f36_doado": "automatico do rateio NFP — doadores automaticos (editavel)",
            "soulcial_base": "manual",
            "total_captador": "automatico do rateio NFP — bruto lojas Diego (editavel)",
            "digitadas_diego": "manual",
        },
    }


async def _valores_sugeridos_rateio(
    db: AsyncSession,
    organizacao_id: str,
    ref: str,
) -> dict[str, float]:
    """Le o dashboard NFP da ref. de credito e devolve F35/F36/total captador."""
    dash = await resumo_dashboard(db, organizacao_id, ref, agente="DIEGO")
    f36 = float(dash.get("doador_automatico_total") or 0)
    aeb = float(dash.get("aeb_total_competencia") or dash.get("total_aeb") or 0)
    f35 = max(0.0, aeb - f36)
    total_captador = float(dash.get("bruto_lojas_agente") or dash.get("bruto_lojas_diego") or 0)
    return {
        "ref": ref,
        "f35_digitado": round(f35, 2),
        "f36_doado": round(f36, 2),
        "total_captador": round(total_captador, 2),
        "parte_diego": float(dash.get("parte_agente") or 0),
        "tem_rateio": bool(aeb or f36 or total_captador),
    }


async def _aplicar_sugestao_rateio_cabecalho(
    cab: NfpMetasCompetenciaDB,
    sugestao: dict[str, float],
    *,
    sobrescrever: bool = False,
) -> bool:
    """Preenche cabecalho a partir do rateio. Retorna True se alterou algo."""
    alterou = False
    if sobrescrever or not float(cab.f36_doado or 0):
        novo = float(sugestao["f36_doado"])
        if float(cab.f36_doado or 0) != novo:
            cab.f36_doado = novo
            alterou = True
    if sobrescrever or not float(cab.f35_digitado or 0):
        novo = float(sugestao["f35_digitado"])
        if float(cab.f35_digitado or 0) != novo:
            cab.f35_digitado = novo
            alterou = True
    if sobrescrever or not float(cab.total_captador or 0):
        novo = float(sugestao["total_captador"])
        if float(cab.total_captador or 0) != novo:
            cab.total_captador = novo
            alterou = True
    return alterou


async def obter_metas(
    db: AsyncSession,
    organizacao_id: str,
    competencia: str,
    *,
    sincronizar_doadas: bool = True,
    auto_rateio: bool = True,
) -> dict:
    cab = await _obter_ou_criar_competencia(db, organizacao_id, competencia)
    linhas = await _linhas_comp(db, cab.id)

    # Garante linhas para todos os projetos padrao
    existentes = {l.codigo_projeto for l in linhas}
    agora = agora_operacional_naive()
    for i, projeto in enumerate(PROJETOS_METAS_NFP):
        if projeto not in existentes:
            nova = NfpMetasLinhaDB(
                competencia_id=cab.id,
                codigo_projeto=projeto,
                ordem=i + 1,
                atualizado_em=agora,
            )
            db.add(nova)
            linhas.append(nova)
    await db.flush()

    if not (cab.ref_credito or "").strip():
        cab.ref_credito = ref_credito_padrao(cab.competencia)

    origem_rateio = None
    precisa_rateio = auto_rateio and (
        not float(cab.f35_digitado or 0)
        or not float(cab.f36_doado or 0)
        or not float(cab.total_captador or 0)
    )
    if precisa_rateio:
        ref = (cab.ref_credito or cab.competencia or "").strip()
        try:
            sugestao = await _valores_sugeridos_rateio(db, organizacao_id, ref)
            if sugestao.get("tem_rateio"):
                await _aplicar_sugestao_rateio_cabecalho(cab, sugestao, sobrescrever=False)
                origem_rateio = sugestao
        except (ValueError, TypeError, KeyError):
            origem_rateio = None
        except Exception:
            # Dashboard/rateio indisponivel nao bloqueia a tela
            origem_rateio = None

    if sincronizar_doadas:
        contagem = await contar_doadores_por_projeto(db, organizacao_id)
        for linha in linhas:
            # So preenche se ainda zerado — nao sobrescreve ajuste manual >0 sem flag
            if int(linha.doadas or 0) == 0 and contagem.get(linha.codigo_projeto, 0) > 0:
                linha.doadas = contagem[linha.codigo_projeto]

    resumo = _aplicar_calculo(cab, linhas)
    cab.atualizado_em = agora_operacional_naive()
    await db.commit()
    await db.refresh(cab)
    linhas = await _linhas_comp(db, cab.id)
    data = serializar_metas(cab, linhas, resumo)
    if origem_rateio:
        data["sugestao_origem"] = {
            "ref": origem_rateio["ref"],
            "f35_digitado": origem_rateio["f35_digitado"],
            "f36_doado": origem_rateio["f36_doado"],
            "total_captador": origem_rateio["total_captador"],
            "parte_diego": origem_rateio["parte_diego"],
            "automatico": True,
        }
    return data


async def salvar_metas(
    db: AsyncSession,
    organizacao_id: str,
    competencia: str,
    payload: dict,
) -> dict:
    cab = await _obter_ou_criar_competencia(db, organizacao_id, competencia)
    linhas = await _linhas_comp(db, cab.id)
    por_codigo = {l.codigo_projeto: l for l in linhas}

    cab.ref_credito = (payload.get("ref_credito") or cab.ref_credito or "").strip() or None
    cab.titulo = (payload.get("titulo") or cab.titulo or "").strip() or None
    cab.data_liberacao_credito = (
        (payload.get("data_liberacao_credito") or cab.data_liberacao_credito or "").strip() or None
    )
    cab.observacoes = (payload.get("observacoes") or cab.observacoes or "").strip() or None
    if payload.get("status") in {"rascunho", "fechado"}:
        cab.status = payload["status"]

    params = payload.get("parametros") or {}
    if "pct_fundo" in params:
        cab.pct_fundo = _float(params.get("pct_fundo"), 0.3)
    if "pct_soulcial" in params:
        cab.pct_soulcial = _float(params.get("pct_soulcial"), 0.2)
    if "pct_fundo_soulcial" in params:
        cab.pct_fundo_soulcial = _float(params.get("pct_fundo_soulcial"), 0.1)
    if "pct_premiacao" in params:
        cab.pct_premiacao = _float(params.get("pct_premiacao"), 0.1)
    if "pct_diego" in params:
        cab.pct_diego = _float(params.get("pct_diego"), 0.5)

    head = payload.get("cabecalho") or {}
    for campo in ("f35_digitado", "f36_doado", "soulcial_base", "total_captador"):
        if campo in head:
            setattr(cab, campo, _float(head.get(campo)))
    if "digitadas_diego" in head:
        cab.digitadas_diego = _int(head.get("digitadas_diego"))

    for item in payload.get("linhas") or []:
        codigo = codigo_projeto_metas(item.get("codigo_projeto")) or (item.get("codigo_projeto") or "").strip()
        linha = por_codigo.get(codigo)
        if not linha:
            continue
        if "digitadas" in item:
            linha.digitadas = _int(item.get("digitadas"))
        if "doadas" in item:
            linha.doadas = _int(item.get("doadas"))
        if "soulcial" in item:
            linha.soulcial = _float(item.get("soulcial"))
        if "soulcial_campanhas" in item:
            linha.soulcial_campanhas = _float(item.get("soulcial_campanhas"))

    resumo = _aplicar_calculo(cab, linhas)
    cab.atualizado_em = agora_operacional_naive()
    await db.commit()
    await db.refresh(cab)
    linhas = await _linhas_comp(db, cab.id)
    return serializar_metas(cab, linhas, resumo)


async def sugerir_do_rateio(
    db: AsyncSession,
    organizacao_id: str,
    competencia: str,
    *,
    sobrescrever: bool = False,
) -> dict:
    """
    Atualiza cabecalho a partir do dashboard NFP da ref. de credito
    (ou da propria competencia se ref_credito vazio).
    Usado para forcar recarga; o GET /metas ja aplica automaticamente quando vazio.
    """
    cab = await _obter_ou_criar_competencia(db, organizacao_id, competencia)
    if not (cab.ref_credito or "").strip():
        cab.ref_credito = ref_credito_padrao(cab.competencia)
    ref = (cab.ref_credito or cab.competencia or "").strip()
    sugestao = await _valores_sugeridos_rateio(db, organizacao_id, ref)
    await _aplicar_sugestao_rateio_cabecalho(cab, sugestao, sobrescrever=sobrescrever)

    contagem = await contar_doadores_por_projeto(db, organizacao_id)
    linhas = await _linhas_comp(db, cab.id)
    for linha in linhas:
        if sobrescrever or int(linha.doadas or 0) == 0:
            linha.doadas = int(contagem.get(linha.codigo_projeto, 0))

    resumo = _aplicar_calculo(cab, linhas)
    cab.atualizado_em = agora_operacional_naive()
    await db.commit()
    await db.refresh(cab)
    linhas = await _linhas_comp(db, cab.id)
    data = serializar_metas(cab, linhas, resumo)
    data["sugestao_origem"] = {
        "ref": ref,
        "f35_digitado": sugestao["f35_digitado"],
        "f36_doado": sugestao["f36_doado"],
        "total_captador": sugestao["total_captador"],
        "parte_diego": sugestao["parte_diego"],
        "automatico": False,
    }
    return data


async def listar_competencias_metas(db: AsyncSession, organizacao_id: str) -> list[dict]:
    rows = (
        await db.execute(
            select(NfpMetasCompetenciaDB)
            .where(NfpMetasCompetenciaDB.organizacao_id == organizacao_id)
            .order_by(NfpMetasCompetenciaDB.competencia.desc())
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "competencia": r.competencia,
            "ref_credito": r.ref_credito,
            "titulo": r.titulo,
            "status": r.status,
            "atualizado_em": r.atualizado_em.isoformat() if r.atualizado_em else None,
        }
        for r in rows
    ]


async def consolidado_metas(
    db: AsyncSession,
    organizacao_id: str,
    competencias: Optional[list[str]] = None,
) -> dict:
    q = select(NfpMetasCompetenciaDB).where(NfpMetasCompetenciaDB.organizacao_id == organizacao_id)
    if competencias:
        q = q.where(NfpMetasCompetenciaDB.competencia.in_(competencias))
    cabs = (await db.execute(q.order_by(NfpMetasCompetenciaDB.competencia))).scalars().all()

    por_projeto: dict[str, dict] = {
        p: {"codigo_projeto": p, "digitadas": 0, "doadas": 0, "valor_total": 0.0, "total": 0.0}
        for p in PROJETOS_METAS_NFP
    }
    meses = []
    for cab in cabs:
        linhas = await _linhas_comp(db, cab.id)
        meses.append(
            {
                "competencia": cab.competencia,
                "f35_digitado": float(cab.f35_digitado or 0),
                "f36_doado": float(cab.f36_doado or 0),
                "total_captador": float(cab.total_captador or 0),
                "digitadas_diego": int(cab.digitadas_diego or 0),
            }
        )
        for l in linhas:
            dest = por_projeto[l.codigo_projeto]
            dest["digitadas"] += int(l.digitadas or 0)
            dest["doadas"] += int(l.doadas or 0)
            dest["valor_total"] = round(dest["valor_total"] + float(l.valor_total or 0), 2)
            dest["total"] = round(dest["total"] + float(l.total or 0), 2)

    ranking = sorted(por_projeto.values(), key=lambda x: x["total"], reverse=True)
    for i, item in enumerate(ranking, start=1):
        item["colocacao"] = i

    return {"meses": meses, "por_projeto": ranking}


async def exportar_metas_xlsx(dados: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = dados.get("competencia") or "Metas"
    ws.append(
        [
            "PROJETO",
            "DIGITADAS",
            "%",
            "DOADAS",
            "%",
            "VALOR DIGITADO",
            "VALOR APLICATIVO",
            "VALOR TOTAL",
            "SOULCIAL",
            "SOULCIAL CAMPANHAS",
            "DIEGO",
            "TOTAL",
        ]
    )
    for l in dados.get("linhas") or []:
        ws.append(
            [
                l["codigo_projeto"],
                l["digitadas"],
                l["pct_digitadas"],
                l["doadas"],
                l["pct_doadas"],
                l["valor_digitado"],
                l["valor_aplicativo"],
                l["valor_total"],
                l["soulcial"],
                l["soulcial_campanhas"],
                l["diego"],
                l["total"],
            ]
        )
    calc = dados.get("calculado") or {}
    head = dados.get("cabecalho") or {}
    ws.append([])
    ws.append(["F35 DIGITADO", head.get("f35_digitado"), "G35 FUNDO", calc.get("g35_fundo"), "H35", calc.get("h35_projetos")])
    ws.append(["F36 DOADO", head.get("f36_doado"), "G36 FUNDO", calc.get("g36_fundo"), "H36", calc.get("h36_projetos")])
    ws.append(["TOTAL GERAL AEB", calc.get("total_geral_aeb"), "TOTAL RATEIO", calc.get("total_rateio_geral")])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
