"""Dependências compartilhadas do módulo financeiro."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import OrganizacaoDB
from organizacao_pacote import TIPO_PACOTE_FINANCEIRO_PESSOAL, normalizar_tipo_pacote
from security import get_usuario_logado, usuario_eh_manutencao


async def exigir_org_financeira(
    usuario_atual: dict = Depends(get_usuario_logado),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not usuario_eh_manutencao(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Módulo Finanças disponível apenas para Manutenção.",
        )

    org_id = usuario_atual.get("organizacao_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione a organização Finanças.",
        )

    tipo_token = normalizar_tipo_pacote(usuario_atual.get("organizacao_tipo_pacote"))
    if tipo_token != TIPO_PACOTE_FINANCEIRO_PESSOAL:
        resultado = await db.execute(
            select(OrganizacaoDB).where(OrganizacaoDB.id == org_id)
        )
        org = resultado.scalar_one_or_none()
        tipo_db = normalizar_tipo_pacote(getattr(org, "tipo_pacote", None) if org else None)
        if tipo_db != TIPO_PACOTE_FINANCEIRO_PESSOAL:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organização atual não é Finanças.",
            )

    return usuario_atual
