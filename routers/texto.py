# =====================================================================
# ARQUIVO: routers/texto.py — Revisão de texto via Gemini
# =====================================================================
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ConviventeDB, TextoRevisaoUsoMensalDB, UsuarioDB
from revisao_texto import (
    chamar_gemini_revisar_texto,
    gemini_configurado,
    limite_mensal_revisao_texto,
    referencia_mes_operacional,
)
from schemas import TextoRevisarRequest, TextoRevisarResponse, TextoRevisaoStatusResponse
from security import get_usuario_logado
from tenant_scope import obter_instituicao_escopo
from time_operacional import agora_operacional_naive
from texto_revisao_privacidade import (
    MENSAGEM_NOMES_REVISAO_AVISO,
    MENSAGEM_NOMES_REVISAO_OCORRENCIA,
    detectar_nomes_proprios_no_texto,
    montar_fragmentos_nomes_cadastrados,
)

router = APIRouter(prefix="/api/texto", tags=["Revisão de Texto"])


async def _obter_contagem_uso(
    db: AsyncSession,
    instituicao_id: str,
    ano: int,
    mes: int,
) -> int:
    registro = (
        await db.execute(
            select(TextoRevisaoUsoMensalDB).where(
                TextoRevisaoUsoMensalDB.instituicao_id == instituicao_id,
                TextoRevisaoUsoMensalDB.ano == ano,
                TextoRevisaoUsoMensalDB.mes == mes,
            )
        )
    ).scalar_one_or_none()
    return int(registro.contagem if registro else 0)


async def _incrementar_uso(
    db: AsyncSession,
    instituicao_id: str,
    ano: int,
    mes: int,
) -> int:
    registro = (
        await db.execute(
            select(TextoRevisaoUsoMensalDB).where(
                TextoRevisaoUsoMensalDB.instituicao_id == instituicao_id,
                TextoRevisaoUsoMensalDB.ano == ano,
                TextoRevisaoUsoMensalDB.mes == mes,
            )
        )
    ).scalar_one_or_none()

    if registro:
        registro.contagem = int(registro.contagem or 0) + 1
        registro.atualizado_em = agora_operacional_naive()
    else:
        registro = TextoRevisaoUsoMensalDB(
            instituicao_id=instituicao_id,
            ano=ano,
            mes=mes,
            contagem=1,
            atualizado_em=agora_operacional_naive(),
        )
        db.add(registro)

    await db.commit()
    return int(registro.contagem)


async def _carregar_fragmentos_nomes_instituicao(
    db: AsyncSession,
    instituicao_id: str,
) -> set[str]:
    conviventes_db = (
        await db.execute(
            select(ConviventeDB.nome_completo, ConviventeDB.nome_social).where(
                ConviventeDB.instituicao_id == instituicao_id,
            )
        )
    ).all()
    usuarios_db = (
        await db.execute(
            select(UsuarioDB.nome).where(UsuarioDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()

    nomes_conviventes: list[str | None] = []
    for nome_completo, nome_social in conviventes_db:
        nomes_conviventes.extend([nome_completo, nome_social])

    return montar_fragmentos_nomes_cadastrados(nomes_conviventes, usuarios_db)


@router.get("/revisar/status", response_model=TextoRevisaoStatusResponse)
async def status_revisao_texto(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ano, mes = referencia_mes_operacional()
    limite = limite_mensal_revisao_texto()
    usado = await _obter_contagem_uso(db, instituicao_id, ano, mes)
    configurado = gemini_configurado()
    disponivel = configurado and (limite <= 0 or usado < limite)

    return TextoRevisaoStatusResponse(
        configurado=configurado,
        disponivel=disponivel,
        limite_mensal=limite,
        usado_mes=usado,
        ano=ano,
        mes=mes,
    )


@router.post("/revisar", response_model=TextoRevisarResponse)
async def revisar_texto(
    payload: TextoRevisarRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    if not gemini_configurado():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Revisão de texto não configurada neste ambiente.",
        )

    titulo = (payload.titulo or "").strip()
    texto = (payload.texto or "").strip()

    if not titulo and not texto:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe título ou texto para revisar.",
        )

    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ano, mes = referencia_mes_operacional()
    limite = limite_mensal_revisao_texto()
    usado = await _obter_contagem_uso(db, instituicao_id, ano, mes)

    if limite > 0 and usado >= limite:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Limite mensal de {limite} revisões atingido. Tente no próximo mês ou contate a gestão.",
        )

    fragmentos_nomes = await _carregar_fragmentos_nomes_instituicao(db, instituicao_id)
    contexto = (payload.contexto or "").strip().lower()
    revisao_aviso = contexto == "aviso"
    nomes_detectados = detectar_nomes_proprios_no_texto(
        titulo,
        texto,
        fragmentos_nomes,
        usar_fragmentos_cadastrados=not revisao_aviso,
    )
    if nomes_detectados:
        mensagem_bloqueio = (
            MENSAGEM_NOMES_REVISAO_AVISO if revisao_aviso else MENSAGEM_NOMES_REVISAO_OCORRENCIA
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mensagem_bloqueio,
        )

    try:
        resultado = await asyncio.to_thread(chamar_gemini_revisar_texto, titulo, texto)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    usado_apos = await _incrementar_uso(db, instituicao_id, ano, mes)
    limite_efetivo = limite if limite > 0 else None

    return TextoRevisarResponse(
        titulo=resultado.get("titulo", titulo),
        texto=resultado.get("texto", texto),
        titulo_original=titulo,
        texto_original=texto,
        usado_mes=usado_apos,
        limite_mensal=limite_efetivo,
    )
