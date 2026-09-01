"""Schemas Pydantic do módulo financeiro pessoal (CareCore+)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FinanceiroContaBase(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    tipo: str = Field(default="corrente", max_length=40)
    saldo: float = 0.0
    rende: bool = False


class FinanceiroContaCreate(FinanceiroContaBase):
    pass


class FinanceiroContaUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tipo: Optional[str] = Field(default=None, max_length=40)
    saldo: Optional[float] = None
    rende: Optional[bool] = None


class FinanceiroContaResponse(FinanceiroContaBase):
    id: str
    organizacao_id: str
    criado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FinanceiroTransacaoBase(BaseModel):
    descricao: str = Field(min_length=1, max_length=500)
    valor: float
    tipo: str = Field(max_length=20)
    categoria: Optional[str] = Field(default=None, max_length=120)
    data: date
    conta_id: Optional[str] = None
    pago: bool = True
    origem_arquivo: Optional[str] = None
    parcela_atual: Optional[int] = None
    parcelas_total: Optional[int] = None


class FinanceiroTransacaoCreate(FinanceiroTransacaoBase):
    pass


class FinanceiroTransacaoUpdate(BaseModel):
    descricao: Optional[str] = Field(default=None, min_length=1, max_length=500)
    valor: Optional[float] = None
    tipo: Optional[str] = Field(default=None, max_length=20)
    categoria: Optional[str] = Field(default=None, max_length=120)
    data: Optional[date] = None
    conta_id: Optional[str] = None
    pago: Optional[bool] = None


class FinanceiroTransacaoResponse(FinanceiroTransacaoBase):
    id: str
    organizacao_id: str
    criado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FinanceiroDashboardResumo(BaseModel):
    saldo_total: float = 0.0
    contas_ativas: int = 0
    receitas_mes: float = 0.0
    despesas_mes: float = 0.0
    transacoes_recentes: list[FinanceiroTransacaoResponse] = Field(default_factory=list)
