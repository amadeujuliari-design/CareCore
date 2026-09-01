"""Conferencia pre-prazo NFP: batimento cupons x Pedidos SEFAZ (CADASTRO)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import NfpCupomLidoDB
from nfp_cupom_utils import janela_aviso_conferencia_sefaz, refs_emissao_vencendo_no_mes
from nfp_service import _ler_planilha_csv
from nfp_utils import limpar_documento, limpar_nota, valor_para_centavos
from time_operacional import agora_operacional_naive

MENSAGEM_REENFILEIRO = (
    "Reenfileirado: conferencia SEFAZ sem pedido correspondente — reteste pelo robo."
)


def _data_br(valor) -> str:
    texto = str(valor or "").strip()
    if len(texto) >= 10 and texto[4] == "-":
        y, m, d = texto[:10].split("-")
        return f"{d}/{m}/{y}"
    if hasattr(valor, "strftime"):
        return valor.strftime("%d/%m/%Y")
    return texto.split(" ")[0]


def _fmt_dt(valor) -> str:
    if valor is None:
        return ""
    if hasattr(valor, "strftime"):
        return valor.strftime("%Y-%m-%d %H:%M:%S")
    return str(valor)


def _variants_numero(num: str) -> set[str]:
    n = limpar_nota(num)
    if not n:
        return set()
    bare = n.lstrip("0") or "0"
    out = {n, bare, n.zfill(9), bare.zfill(9)}
    if len(bare) <= 6:
        out.add("000" + bare)
    return out


def _numero_batimento(row: NfpCupomLidoDB) -> str:
    bruto = getattr(row, "numero_nota_sefaz", None) or row.numero_nf
    return limpar_nota(bruto)


def _valor_batimento(row: NfpCupomLidoDB) -> int:
    v = getattr(row, "valor_sefaz_centavos", None)
    if v is not None:
        return int(v)
    return int(row.valor_centavos or 0)


def _cnpj_batimento(row: NfpCupomLidoDB) -> str:
    bruto = getattr(row, "cnpj_sefaz", None) or row.cnpj_emitente
    return limpar_documento(bruto)


def ler_pedidos_cadastro_csv(conteudo: bytes) -> list[dict[str, Any]]:
    _, dados = _ler_planilha_csv(conteudo)
    saida: list[dict[str, Any]] = []
    vistos: set[tuple] = set()
    for row in dados:
        tipo = str(row.get("Tipo da Doação") or row.get("Tipo da Doao") or "")
        if "CADASTRO" not in tipo.upper():
            continue
        cnpj = limpar_documento(row.get("CNPJ Estabelecimento"))
        numero = limpar_nota(row.get("Número da Nota"))
        data_pedido = str(row.get("Data do Pedido") or "").split()[0]
        valor_cent = valor_para_centavos(row.get("Valor da Nota"))
        chave = (cnpj, numero, data_pedido, valor_cent)
        if chave in vistos:
            continue
        vistos.add(chave)
        saida.append(
            {
                "cnpj": cnpj,
                "numero": numero,
                "numero_curto": numero.lstrip("0") or numero,
                "data_pedido": data_pedido,
                "valor_cent": valor_cent,
                "status": str(row.get("Status do Pedido") or ""),
            }
        )
    return saida


def cupom_para_batimento(row: NfpCupomLidoDB) -> dict[str, Any]:
    numero = _numero_batimento(row)
    return {
        "id": row.id,
        "chave": limpar_documento(row.chave),
        "captador": str(row.captador or ""),
        "cnpj": _cnpj_batimento(row),
        "numero": numero,
        "numero_curto": numero.lstrip("0") or numero,
        "data_emissao": _data_br(row.data_emissao),
        "data_emissao_ref": str(row.data_emissao_ref or ""),
        "valor_cent": _valor_batimento(row),
        "valor": _valor_batimento(row) / 100 if _valor_batimento(row) else 0,
        "enviado_em": _fmt_dt(row.enviado_em),
        "enviado_data_br": _data_br(row.enviado_em),
        "mensagem": str(row.mensagem or ""),
        "tipo_retorno_sefaz": str(getattr(row, "tipo_retorno_sefaz", None) or ""),
        "numero_nota_sefaz": limpar_nota(getattr(row, "numero_nota_sefaz", None) or ""),
        "numero_nf_chave": limpar_nota(row.numero_nf),
    }


def executar_batimento(
    cupons: list[dict[str, Any]],
    pedidos: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    by_cnpj_num: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_cnpj_num_valor: dict[tuple[str, str, int], list[int]] = defaultdict(list)
    for i, p in enumerate(pedidos):
        for v in _variants_numero(p["numero"]):
            by_cnpj_num[(p["cnpj"], v)].append(i)
        if p.get("valor_cent"):
            for v in _variants_numero(p["numero"]):
                by_cnpj_num_valor[(p["cnpj"], v, int(p["valor_cent"]))].append(i)

    used: set[int] = set()
    resultados: list[dict[str, Any]] = []
    totais: dict[str, int] = defaultdict(int)

    for c in cupons:
        ped_idx: int | None = None
        metodo = ""
        valor_c = int(c.get("valor_cent") or 0)

        if valor_c > 0:
            for key in ((c["cnpj"], v, valor_c) for v in _variants_numero(c["numero"])):
                lst = [i for i in by_cnpj_num_valor.get(key, []) if i not in used]
                if lst:
                    ped_idx = lst[0]
                    metodo = "CNPJ + Numero + Valor (Pedidos)"
                    break

        if ped_idx is None:
            for key in ((c["cnpj"], v) for v in _variants_numero(c["numero"])):
                lst = [i for i in by_cnpj_num.get(key, []) if i not in used]
                if lst:
                    ped_idx = lst[0]
                    metodo = "CNPJ + Numero (Pedidos)"
                    break

        if ped_idx is not None:
            used.add(ped_idx)
            p = pedidos[ped_idx]
            situacao = "OK — pedido na SEFAZ"
            totais["ok"] += 1
        else:
            msg = (c.get("mensagem") or "").lower()
            tipo = (c.get("tipo_retorno_sefaz") or "").lower()
            if "ja existe" in msg or tipo == "ja_existe":
                situacao = "DUVIDOSO — ja existe sem match no Pedidos"
                totais["duvidoso_ja_existe"] += 1
            elif "aguardando" in msg or tipo == "sucesso":
                situacao = "AGUARDANDO — sucesso recente sem Pedidos ainda"
                totais["aguardando"] += 1
            else:
                situacao = "NAO ENCONTRADO — sem pedido CADASTRO"
                totais["nao_encontrado"] += 1

        resultados.append(
            {
                **c,
                "situacao": situacao,
                "metodo_match": metodo,
                "pedido_status": pedidos[ped_idx]["status"] if ped_idx is not None else "",
                "pedido_data": pedidos[ped_idx]["data_pedido"] if ped_idx is not None else "",
            }
        )

    return resultados, dict(totais)


async def obter_aviso_conferencia(
    db: AsyncSession,
    organizacao_id: str,
    *,
    hoje: Optional[date] = None,
) -> dict[str, Any]:
    janela = janela_aviso_conferencia_sefaz(hoje)
    refs = list(janela.get("refs_emissao_prioridade") or [])
    prioridade = 0
    if refs:
        prioridade = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(NfpCupomLidoDB)
                    .where(
                        NfpCupomLidoDB.organizacao_id == organizacao_id,
                        NfpCupomLidoDB.data_emissao_ref.in_(refs),
                        NfpCupomLidoDB.status.in_(("pendente", "reservado", "enviado")),
                    )
                )
            ).scalar()
            or 0
        )
    return {**janela, "cupons_prioridade": prioridade}


async def resumo_conferencia(
    db: AsyncSession,
    organizacao_id: str,
    *,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> dict[str, Any]:
    filtros = [NfpCupomLidoDB.organizacao_id == organizacao_id]
    if data_inicio:
        filtros.append(NfpCupomLidoDB.enviado_em >= data_inicio)
    if data_fim:
        filtros.append(NfpCupomLidoDB.enviado_em < data_fim)

    contagens_rows = (
        await db.execute(
            select(NfpCupomLidoDB.status, func.count())
            .where(*filtros)
            .group_by(NfpCupomLidoDB.status)
        )
    ).all()
    contagens = {str(s or ""): int(n or 0) for s, n in contagens_rows}

    com_meta = int(
        (
            await db.execute(
                select(func.count())
                .select_from(NfpCupomLidoDB)
                .where(
                    *filtros,
                    NfpCupomLidoDB.status == "enviado",
                    or_(
                        NfpCupomLidoDB.numero_nota_sefaz.isnot(None),
                        NfpCupomLidoDB.valor_sefaz_centavos.isnot(None),
                    ),
                )
            )
        ).scalar()
        or 0
    )

    aviso = await obter_aviso_conferencia(db, organizacao_id)
    return {
        "contagens": contagens,
        "enviados_com_metadados_sefaz": com_meta,
        "aviso": aviso,
    }


async def batimento_pedidos_upload(
    db: AsyncSession,
    organizacao_id: str,
    *,
    conteudo_csv: bytes,
    status_cupom: str = "enviado",
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> dict[str, Any]:
    pedidos = ler_pedidos_cadastro_csv(conteudo_csv)
    filtros = [
        NfpCupomLidoDB.organizacao_id == organizacao_id,
        NfpCupomLidoDB.status == status_cupom,
    ]
    if data_inicio:
        filtros.append(NfpCupomLidoDB.enviado_em >= data_inicio)
    if data_fim:
        filtros.append(NfpCupomLidoDB.enviado_em < data_fim)

    rows = (
        await db.execute(
            select(NfpCupomLidoDB)
            .where(*filtros)
            .order_by(NfpCupomLidoDB.enviado_em.asc(), NfpCupomLidoDB.chave.asc())
        )
    ).scalars().all()

    cupons = [cupom_para_batimento(r) for r in rows]
    resultados, totais = executar_batimento(cupons, pedidos)
    reenfileiraveis = [
        r["chave"]
        for r in resultados
        if str(r.get("situacao") or "").startswith("NAO ENCONTRADO")
        or str(r.get("situacao") or "").startswith("DUVIDOSO")
    ]
    return {
        "pedidos_cadastro": len(pedidos),
        "cupons_analisados": len(cupons),
        "totais": totais,
        "reenfileiraveis": len(reenfileiraveis),
        "itens": resultados,
        "chaves_reenfileiraveis": reenfileiraveis,
    }


async def reenfileirar_cupons_conferencia(
    db: AsyncSession,
    organizacao_id: str,
    *,
    chaves: list[str],
    situacoes_permitidas: Optional[set[str]] = None,
) -> dict[str, Any]:
    permitidas = situacoes_permitidas or {"enviado"}
    agora = agora_operacional_naive()
    chaves_limpas = []
    for ch in chaves:
        dig = "".join(c for c in str(ch) if c.isdigit())
        if len(dig) == 44:
            chaves_limpas.append(dig)
    if not chaves_limpas:
        return {"ok": True, "atualizados": 0, "ignorados": 0}

    rows = (
        await db.execute(
            select(NfpCupomLidoDB).where(
                NfpCupomLidoDB.organizacao_id == organizacao_id,
                NfpCupomLidoDB.chave.in_(chaves_limpas),
            )
        )
    ).scalars().all()

    atualizados = 0
    ignorados = 0
    for row in rows:
        if row.status not in permitidas:
            ignorados += 1
            continue
        if row.status == "rejeitado_prazo":
            ignorados += 1
            continue
        row.status = "pendente"
        row.mensagem = MENSAGEM_REENFILEIRO
        row.enviado_em = None
        row.lote_id = None
        row.reservado_em = None
        row.reservado_por = None
        row.atualizado_em = agora
        atualizados += 1

    await db.commit()
    return {"ok": True, "atualizados": atualizados, "ignorados": ignorados}


def parse_sefaz_registrado_em(texto: str) -> Optional[datetime]:
    """Extrai DD/MM/AAAA HH:MM:SS embutido no banner de sucesso."""
    import re

    m = re.search(
        r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})",
        texto or "",
    )
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%d/%m/%Y %H:%M:%S")
    except ValueError:
        return None
