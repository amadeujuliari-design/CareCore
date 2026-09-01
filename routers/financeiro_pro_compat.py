"""Endpoints compatíveis com o contrato Finance.Pro (para UI portada)."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from financeiro_compat import (
    conta_de_finance_pro,
    conta_para_finance_pro,
    investimento_de_finance_pro,
    investimento_para_finance_pro,
    regra_de_finance_pro,
    regra_para_finance_pro,
    transacao_de_finance_pro,
    transacao_para_finance_pro,
)
from models import (
    FinanceiroContaDB,
    FinanceiroInvestimentoDB,
    FinanceiroRegraCategoriaDB,
    FinanceiroTransacaoDB,
)
from financeiro_deps import exigir_org_financeira
from time_operacional import agora_operacional_naive

router = APIRouter(
    prefix="/api/financeiro/pro",
    tags=["Financeiro pessoal — compat Finance.Pro"],
)

_TABELAS = {
    "transactions": FinanceiroTransacaoDB,
    "accounts": FinanceiroContaDB,
    "investments": FinanceiroInvestimentoDB,
    "category_rules": FinanceiroRegraCategoriaDB,
}

_UPLOADS_FINANCEIRO = Path("uploads/financeiro")


def _serializar(tabela: str, registro) -> dict:
    if tabela == "transactions":
        return transacao_para_finance_pro(registro)
    if tabela == "accounts":
        return conta_para_finance_pro(registro)
    if tabela == "investments":
        return investimento_para_finance_pro(registro)
    return regra_para_finance_pro(registro)


def _instanciar(tabela: str, org_id: str, payload: dict):
    if tabela == "transactions":
        return transacao_de_finance_pro(org_id, payload)
    if tabela == "accounts":
        return conta_de_finance_pro(org_id, payload)
    if tabela == "investments":
        return investimento_de_finance_pro(org_id, payload)
    return regra_de_finance_pro(org_id, payload)


def _ordenar(tabela: str, consulta):
    if tabela == "transactions":
        return consulta.order_by(
            FinanceiroTransacaoDB.data.desc(),
            FinanceiroTransacaoDB.criado_em.desc(),
        )
    if tabela == "accounts":
        return consulta.order_by(FinanceiroContaDB.nome)
    if tabela == "investments":
        return consulta.order_by(FinanceiroInvestimentoDB.criado_em.desc())
    return consulta.order_by(FinanceiroRegraCategoriaDB.palavra_chave)


@router.get("/{tabela}")
async def listar_pro(
    tabela: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    modelo = _TABELAS.get(tabela)
    if not modelo:
        raise HTTPException(status_code=404, detail=f"Tabela desconhecida: {tabela}")

    org_id = usuario_atual["organizacao_id"]
    consulta = select(modelo).where(modelo.organizacao_id == org_id)
    resultado = await db.execute(_ordenar(tabela, consulta))
    return [_serializar(tabela, row) for row in resultado.scalars().all()]


@router.post("/{tabela}", status_code=status.HTTP_201_CREATED)
async def criar_pro(
    tabela: str,
    payload: dict | list = Body(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    modelo = _TABELAS.get(tabela)
    if not modelo:
        raise HTTPException(status_code=404, detail=f"Tabela desconhecida: {tabela}")

    org_id = usuario_atual["organizacao_id"]
    registros = payload if isinstance(payload, list) else [payload]
    inseridos = []

    for item in registros:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Payload inválido.")
        entidade = _instanciar(tabela, org_id, item)
        if not getattr(entidade, "id", None):
            entidade.id = str(uuid.uuid4())
        db.add(entidade)
        inseridos.append(entidade)

    await db.commit()
    for entidade in inseridos:
        await db.refresh(entidade)

    serializados = [_serializar(tabela, row) for row in inseridos]
    return serializados if isinstance(payload, list) else serializados[0]


@router.put("/{tabela}/{registro_id}")
async def atualizar_pro(
    tabela: str,
    registro_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    modelo = _TABELAS.get(tabela)
    if not modelo:
        raise HTTPException(status_code=404, detail=f"Tabela desconhecida: {tabela}")

    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(modelo).where(
            modelo.id == registro_id,
            modelo.organizacao_id == org_id,
        )
    )
    atual = resultado.scalar_one_or_none()
    if not atual:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")

    payload_merged = {**_serializar(tabela, atual), **payload, "id": registro_id}
    novo = _instanciar(tabela, org_id, payload_merged)

    for coluna in modelo.__table__.columns:
        nome = coluna.name
        if nome in ("id", "organizacao_id"):
            continue
        setattr(atual, nome, getattr(novo, nome))

    await db.commit()
    await db.refresh(atual)
    return _serializar(tabela, atual)


@router.delete("/{tabela}/{registro_id}", status_code=status.HTTP_200_OK)
async def excluir_pro(
    tabela: str,
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    modelo = _TABELAS.get(tabela)
    if not modelo:
        raise HTTPException(status_code=404, detail=f"Tabela desconhecida: {tabela}")

    org_id = usuario_atual["organizacao_id"]
    resultado = await db.execute(
        select(modelo).where(
            modelo.id == registro_id,
            modelo.organizacao_id == org_id,
        )
    )
    registro = resultado.scalar_one_or_none()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")

    await db.delete(registro)
    await db.commit()
    return {"ok": True}


@router.post("/upload-invoice", status_code=status.HTTP_201_CREATED)
async def upload_nota_pro(
    file: UploadFile = File(...),
    usuario_atual: dict = Depends(exigir_org_financeira),
):
    org_id = usuario_atual["organizacao_id"]
    destino_dir = _UPLOADS_FINANCEIRO / org_id
    destino_dir.mkdir(parents=True, exist_ok=True)

    extensao = Path(file.filename or "nota.pdf").suffix or ".pdf"
    nome_arquivo = f"{int(agora_operacional_naive().timestamp())}_{uuid.uuid4().hex[:8]}{extensao}"
    caminho = destino_dir / nome_arquivo

    conteudo = await file.read()
    caminho.write_bytes(conteudo)

    url_publica = f"/uploads/financeiro/{org_id}/{nome_arquivo}"
    return {
        "path": f"{org_id}/{nome_arquivo}",
        "publicUrl": url_publica,
    }
