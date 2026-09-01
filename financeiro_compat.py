"""Conversão entre modelos CareCore e contrato Finance.Pro (UI legada)."""

from __future__ import annotations

from datetime import date, datetime

from models import (
    FinanceiroContaDB,
    FinanceiroInvestimentoDB,
    FinanceiroRegraCategoriaDB,
    FinanceiroTransacaoDB,
)


def _parse_date(valor: str | date | None) -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def _parse_datetime(valor: str | datetime | None) -> datetime | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor
    texto = str(valor).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(texto)
    except ValueError:
        return None


def conta_para_finance_pro(conta: FinanceiroContaDB) -> dict:
    return {
        "id": conta.id,
        "user_id": "",
        "name": conta.nome,
        "type": conta.tipo or "checking",
        "balance": float(conta.saldo or 0),
        "created_at": conta.criado_em.isoformat() if conta.criado_em else None,
        "yields": bool(conta.rende),
    }


def conta_de_finance_pro(org_id: str, registro: dict) -> FinanceiroContaDB:
    return FinanceiroContaDB(
        id=str(registro["id"]),
        organizacao_id=org_id,
        nome=str(registro.get("name") or registro.get("nome") or "Conta"),
        tipo=str(registro.get("type") or "checking"),
        saldo=float(registro.get("balance") or registro.get("saldo") or 0),
        rende=bool(registro.get("yields") or registro.get("rende")),
        criado_em=_parse_datetime(registro.get("created_at")),
    )


def transacao_para_finance_pro(tx: FinanceiroTransacaoDB) -> dict:
    return {
        "id": tx.id,
        "user_id": "",
        "account_id": tx.conta_id,
        "card_id": tx.cartao_id,
        "description": tx.descricao,
        "amount": float(tx.valor or 0),
        "type": tx.tipo,
        "category": tx.categoria,
        "date": tx.data.isoformat() if tx.data else None,
        "is_paid": bool(tx.pago),
        "origin_file": tx.origem_arquivo,
        "created_at": tx.criado_em.isoformat() if tx.criado_em else None,
        "current_installment": tx.parcela_atual,
        "total_installments": tx.parcelas_total,
        "is_projected": bool(tx.projetado),
        "invoice_month": tx.mes_fatura,
        "linked_payment_id": tx.pagamento_vinculado_id,
        "whatsapp_cycle_key": tx.ciclo_whatsapp,
        "responsible": tx.responsavel,
        "invoice_url": tx.url_nota,
    }


def transacao_de_finance_pro(org_id: str, registro: dict) -> FinanceiroTransacaoDB:
    return FinanceiroTransacaoDB(
        id=str(registro["id"]),
        organizacao_id=org_id,
        conta_id=registro.get("account_id") or registro.get("conta_id"),
        cartao_id=registro.get("card_id") or registro.get("cartao_id"),
        descricao=str(registro.get("description") or registro.get("descricao") or ""),
        valor=float(registro.get("amount") or registro.get("valor") or 0),
        tipo=str(registro.get("type") or registro.get("tipo") or "expense"),
        categoria=registro.get("category") or registro.get("categoria"),
        data=_parse_date(registro.get("date") or registro.get("data")),
        pago=bool(registro.get("is_paid") if "is_paid" in registro else registro.get("pago", True)),
        origem_arquivo=registro.get("origin_file") or registro.get("origem_arquivo"),
        parcela_atual=registro.get("current_installment") or registro.get("parcela_atual"),
        parcelas_total=registro.get("total_installments") or registro.get("parcelas_total"),
        projetado=bool(registro.get("is_projected") or registro.get("projetado")),
        mes_fatura=registro.get("invoice_month") or registro.get("mes_fatura"),
        pagamento_vinculado_id=registro.get("linked_payment_id") or registro.get("pagamento_vinculado_id"),
        ciclo_whatsapp=registro.get("whatsapp_cycle_key") or registro.get("ciclo_whatsapp"),
        responsavel=registro.get("responsible") or registro.get("responsavel"),
        url_nota=registro.get("invoice_url") or registro.get("url_nota"),
        criado_em=_parse_datetime(registro.get("created_at")),
    )


def investimento_para_finance_pro(item: FinanceiroInvestimentoDB) -> dict:
    return {
        "id": item.id,
        "user_id": "",
        "name": item.nome,
        "type": item.tipo,
        "amount": float(item.valor or 0),
        "rate": float(item.taxa or 0),
        "start_date": item.data_inicio.isoformat() if item.data_inicio else None,
        "liquidity_date": item.data_liquidez.isoformat() if item.data_liquidez else None,
        "status": item.status,
        "currency": item.moeda,
        "created_at": item.criado_em.isoformat() if item.criado_em else None,
        "ir": item.ir,
        "is_cdi": bool(item.cdi),
        "cdi_percent": item.cdi_percentual,
        "liquidity": item.liquidez,
    }


def investimento_de_finance_pro(org_id: str, registro: dict) -> FinanceiroInvestimentoDB:
    return FinanceiroInvestimentoDB(
        id=str(registro["id"]),
        organizacao_id=org_id,
        nome=str(registro.get("name") or registro.get("nome") or ""),
        tipo=registro.get("type") or registro.get("tipo"),
        valor=float(registro.get("amount") or registro.get("valor") or 0),
        taxa=float(registro.get("rate") or registro.get("taxa") or 0),
        data_inicio=_parse_date(registro.get("start_date") or registro.get("data_inicio")),
        data_liquidez=_parse_date(registro.get("liquidity_date") or registro.get("data_liquidez")),
        status=str(registro.get("status") or "active"),
        moeda=str(registro.get("currency") or registro.get("moeda") or "BRL"),
        ir=registro.get("ir"),
        cdi=bool(registro.get("is_cdi") or registro.get("cdi")),
        cdi_percentual=registro.get("cdi_percent") or registro.get("cdi_percentual"),
        liquidez=registro.get("liquidity") or registro.get("liquidez"),
        criado_em=_parse_datetime(registro.get("created_at")),
    )


def regra_para_finance_pro(regra: FinanceiroRegraCategoriaDB) -> dict:
    return {
        "id": regra.id,
        "user_id": "",
        "keyword": regra.palavra_chave,
        "category": regra.categoria,
        "created_at": regra.criado_em.isoformat() if regra.criado_em else None,
    }


def regra_de_finance_pro(org_id: str, registro: dict) -> FinanceiroRegraCategoriaDB:
    return FinanceiroRegraCategoriaDB(
        id=str(registro["id"]),
        organizacao_id=org_id,
        palavra_chave=str(registro.get("keyword") or registro.get("palavra_chave") or ""),
        categoria=str(registro.get("category") or registro.get("categoria") or ""),
        criado_em=_parse_datetime(registro.get("created_at")),
    )
