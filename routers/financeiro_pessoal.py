"""API do módulo financeiro pessoal (org tipo financeiro_pessoal)."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from financeiro_schemas import (
    FinanceiroContaCreate,
    FinanceiroContaResponse,
    FinanceiroContaUpdate,
    FinanceiroDashboardResumo,
    FinanceiroTransacaoCreate,
    FinanceiroTransacaoResponse,
    FinanceiroTransacaoUpdate,
)
from financeiro_deps import exigir_org_financeira
from models import FinanceiroContaDB, FinanceiroTransacaoDB
from time_operacional import agora_operacional_naive


router = APIRouter(
    prefix="/api/financeiro",
    tags=["Financeiro pessoal"],
)


def _inicio_mes_operacional(hoje: date | None = None) -> date:
    referencia = hoje or agora_operacional_naive().date()
    return referencia.replace(day=1)


@router.get("/dashboard", response_model=FinanceiroDashboardResumo)
async def obter_dashboard_financeiro(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    inicio_mes = _inicio_mes_operacional()

    resultado_contas = await db.execute(
        select(FinanceiroContaDB).where(FinanceiroContaDB.organizacao_id == org_id)
    )
    contas = resultado_contas.scalars().all()
    saldo_total = round(sum(float(c.saldo or 0) for c in contas), 2)

    resultado_mes = await db.execute(
        select(
            FinanceiroTransacaoDB.tipo,
            func.coalesce(func.sum(FinanceiroTransacaoDB.valor), 0),
        )
        .where(
            FinanceiroTransacaoDB.organizacao_id == org_id,
            FinanceiroTransacaoDB.data >= inicio_mes,
        )
        .group_by(FinanceiroTransacaoDB.tipo)
    )
    totais_mes = {tipo: float(total) for tipo, total in resultado_mes.all()}

    resultado_recentes = await db.execute(
        select(FinanceiroTransacaoDB)
        .where(FinanceiroTransacaoDB.organizacao_id == org_id)
        .order_by(FinanceiroTransacaoDB.data.desc(), FinanceiroTransacaoDB.criado_em.desc())
        .limit(10)
    )
    recentes = resultado_recentes.scalars().all()

    receitas = (
        totais_mes.get("receita", 0)
        + totais_mes.get("entrada", 0)
        + totais_mes.get("income", 0)
    )
    despesas = (
        abs(totais_mes.get("despesa", 0))
        + abs(totais_mes.get("saida", 0))
        + abs(totais_mes.get("expense", 0))
    )

    return FinanceiroDashboardResumo(
        saldo_total=saldo_total,
        contas_ativas=len(contas),
        receitas_mes=round(receitas, 2),
        despesas_mes=round(despesas, 2),
        transacoes_recentes=recentes,
    )


@router.get("/contas", response_model=list[FinanceiroContaResponse])
async def listar_contas_financeiras(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(FinanceiroContaDB)
        .where(FinanceiroContaDB.organizacao_id == org_id)
        .order_by(FinanceiroContaDB.nome)
    )
    return resultado.scalars().all()


@router.post("/contas", response_model=FinanceiroContaResponse, status_code=status.HTTP_201_CREATED)
async def criar_conta_financeira(
    payload: FinanceiroContaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    conta = FinanceiroContaDB(
        id=str(uuid.uuid4()),
        organizacao_id=org_id,
        nome=payload.nome.strip(),
        tipo=(payload.tipo or "corrente").strip().lower(),
        saldo=float(payload.saldo or 0),
        rende=bool(payload.rende),
    )
    db.add(conta)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.patch("/contas/{conta_id}", response_model=FinanceiroContaResponse)
async def atualizar_conta_financeira(
    conta_id: str,
    payload: FinanceiroContaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(FinanceiroContaDB).where(
            FinanceiroContaDB.id == conta_id,
            FinanceiroContaDB.organizacao_id == org_id,
        )
    )
    conta = resultado.scalar_one_or_none()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    dados = payload.model_dump(exclude_unset=True)
    if "nome" in dados and dados["nome"]:
        conta.nome = dados["nome"].strip()
    if "tipo" in dados and dados["tipo"]:
        conta.tipo = dados["tipo"].strip().lower()
    if "saldo" in dados and dados["saldo"] is not None:
        conta.saldo = float(dados["saldo"])
    if "rende" in dados and dados["rende"] is not None:
        conta.rende = bool(dados["rende"])

    await db.commit()
    await db.refresh(conta)
    return conta


@router.delete("/contas/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_conta_financeira(
    conta_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(FinanceiroContaDB).where(
            FinanceiroContaDB.id == conta_id,
            FinanceiroContaDB.organizacao_id == org_id,
        )
    )
    conta = resultado.scalar_one_or_none()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    await db.delete(conta)
    await db.commit()


@router.get("/transacoes", response_model=list[FinanceiroTransacaoResponse])
async def listar_transacoes_financeiras(
    data_inicio: date | None = Query(default=None),
    data_fim: date | None = Query(default=None),
    conta_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    consulta = select(FinanceiroTransacaoDB).where(
        FinanceiroTransacaoDB.organizacao_id == org_id,
    )

    if data_inicio:
        consulta = consulta.where(FinanceiroTransacaoDB.data >= data_inicio)
    if data_fim:
        consulta = consulta.where(FinanceiroTransacaoDB.data <= data_fim)
    if conta_id:
        consulta = consulta.where(FinanceiroTransacaoDB.conta_id == conta_id)

    consulta = consulta.order_by(
        FinanceiroTransacaoDB.data.desc(),
        FinanceiroTransacaoDB.criado_em.desc(),
    )
    resultado = await db.execute(consulta)
    return resultado.scalars().all()


@router.post("/transacoes", response_model=FinanceiroTransacaoResponse, status_code=status.HTTP_201_CREATED)
async def criar_transacao_financeira(
    payload: FinanceiroTransacaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]

    if payload.conta_id:
        resultado_conta = await db.execute(
            select(FinanceiroContaDB).where(
                FinanceiroContaDB.id == payload.conta_id,
                FinanceiroContaDB.organizacao_id == org_id,
            )
        )
        if not resultado_conta.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Conta inválida para esta organização.")

    transacao = FinanceiroTransacaoDB(
        id=str(uuid.uuid4()),
        organizacao_id=org_id,
        conta_id=payload.conta_id,
        descricao=payload.descricao.strip(),
        valor=float(payload.valor),
        tipo=(payload.tipo or "despesa").strip().lower(),
        categoria=(payload.categoria or "").strip() or None,
        data=payload.data,
        pago=bool(payload.pago),
        origem_arquivo=payload.origem_arquivo,
        parcela_atual=payload.parcela_atual,
        parcelas_total=payload.parcelas_total,
    )
    db.add(transacao)

    if payload.conta_id and payload.pago:
        resultado_conta = await db.execute(
            select(FinanceiroContaDB).where(FinanceiroContaDB.id == payload.conta_id)
        )
        conta = resultado_conta.scalar_one_or_none()
        if conta:
            delta = float(payload.valor)
            if transacao.tipo in {"despesa", "saida"}:
                delta = -abs(delta)
            elif transacao.tipo in {"receita", "entrada"}:
                delta = abs(delta)
            conta.saldo = round(float(conta.saldo or 0) + delta, 2)

    await db.commit()
    await db.refresh(transacao)
    return transacao


@router.patch("/transacoes/{transacao_id}", response_model=FinanceiroTransacaoResponse)
async def atualizar_transacao_financeira(
    transacao_id: str,
    payload: FinanceiroTransacaoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(FinanceiroTransacaoDB).where(
            FinanceiroTransacaoDB.id == transacao_id,
            FinanceiroTransacaoDB.organizacao_id == org_id,
        )
    )
    transacao = resultado.scalar_one_or_none()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    dados = payload.model_dump(exclude_unset=True)
    if "descricao" in dados and dados["descricao"]:
        transacao.descricao = dados["descricao"].strip()
    if "valor" in dados and dados["valor"] is not None:
        transacao.valor = float(dados["valor"])
    if "tipo" in dados and dados["tipo"]:
        transacao.tipo = dados["tipo"].strip().lower()
    if "categoria" in dados:
        transacao.categoria = (dados["categoria"] or "").strip() or None
    if "data" in dados and dados["data"]:
        transacao.data = dados["data"]
    if "conta_id" in dados:
        transacao.conta_id = dados["conta_id"]
    if "pago" in dados and dados["pago"] is not None:
        transacao.pago = bool(dados["pago"])

    await db.commit()
    await db.refresh(transacao)
    return transacao


@router.delete("/transacoes/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_transacao_financeira(
    transacao_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(FinanceiroTransacaoDB).where(
            FinanceiroTransacaoDB.id == transacao_id,
            FinanceiroTransacaoDB.organizacao_id == org_id,
        )
    )
    transacao = resultado.scalar_one_or_none()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    await db.delete(transacao)
    await db.commit()
