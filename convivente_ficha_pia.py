"""Carrega e sincroniza listas da ficha PIA do convivente."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    ConviventeDB,
    ConviventeDocumentoCivilDB,
    ConviventeEquipamentoAnteriorDB,
    ConviventeFamiliarDB,
    ConviventeInternacaoDB,
    ConviventeMedicamentoDB,
    ConviventeSubstanciaDB,
    get_uuid,
)


def _parse_beneficios(valor: Any) -> dict:
    if not valor:
        return {}
    if isinstance(valor, dict):
        return valor
    try:
        return json.loads(valor)
    except (TypeError, json.JSONDecodeError):
        return {}


def _dump_beneficios(valor: Any) -> str | None:
    if not valor:
        return None
    if isinstance(valor, str):
        return valor
    return json.dumps(valor, ensure_ascii=False)


def _parse_situacoes_trabalho(valor: Any) -> list[str]:
    if not valor:
        return []
    if isinstance(valor, list):
        return valor
    try:
        parsed = json.loads(valor)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


def _dump_situacoes_trabalho(valor: Any) -> str | None:
    if not valor:
        return None
    if isinstance(valor, str):
        return valor
    if isinstance(valor, list) and not valor:
        return None
    return json.dumps(valor, ensure_ascii=False)


async def carregar_listas_ficha_pia(db: AsyncSession, convivente_id: str) -> dict[str, list]:
    familiares = (
        await db.execute(
            select(ConviventeFamiliarDB).where(ConviventeFamiliarDB.convivente_id == convivente_id)
        )
    ).scalars().all()
    documentos = (
        await db.execute(
            select(ConviventeDocumentoCivilDB).where(
                ConviventeDocumentoCivilDB.convivente_id == convivente_id
            )
        )
    ).scalars().all()
    substancias = (
        await db.execute(
            select(ConviventeSubstanciaDB).where(ConviventeSubstanciaDB.convivente_id == convivente_id)
        )
    ).scalars().all()
    medicamentos = (
        await db.execute(
            select(ConviventeMedicamentoDB).where(ConviventeMedicamentoDB.convivente_id == convivente_id)
        )
    ).scalars().all()
    internacoes = (
        await db.execute(
            select(ConviventeInternacaoDB).where(ConviventeInternacaoDB.convivente_id == convivente_id)
        )
    ).scalars().all()
    equipamentos = (
        await db.execute(
            select(ConviventeEquipamentoAnteriorDB).where(
                ConviventeEquipamentoAnteriorDB.convivente_id == convivente_id
            )
        )
    ).scalars().all()

    return {
        "familiares": [
            {
                "id": item.id,
                "parentesco": item.parentesco,
                "parentesco_outros": item.parentesco_outros,
                "nome": item.nome,
                "idade": item.idade,
                "cep": item.cep,
                "logradouro": item.logradouro,
                "numero": item.numero,
                "complemento": item.complemento,
                "bairro": item.bairro,
                "cidade": item.cidade,
                "uf": item.uf,
                "endereco": item.endereco,
                "telefone": item.telefone,
            }
            for item in familiares
        ],
        "documentos_civis": [
            {
                "id": item.id,
                "tipo": item.tipo,
                "tipo_outros": item.tipo_outros,
                "numero": item.numero,
                "orientacoes": item.orientacoes,
            }
            for item in documentos
        ],
        "substancias": [
            {
                "id": item.id,
                "tipo": item.tipo,
                "desde_quando": item.desde_quando,
                "quantidade": item.quantidade,
            }
            for item in substancias
        ],
        "medicamentos": [
            {
                "id": item.id,
                "nome": item.nome,
                "tempo_uso": item.tempo_uso,
                "modo_uso": item.modo_uso,
            }
            for item in medicamentos
        ],
        "internacoes": [
            {
                "id": item.id,
                "onde": item.onde,
                "periodo": item.periodo,
                "quem_encaminhou": item.quem_encaminhou,
            }
            for item in internacoes
        ],
        "equipamentos_anteriores": [
            {
                "id": item.id,
                "origem_encaminhamento_id": item.origem_encaminhamento_id,
                "descricao_outros": item.descricao_outros,
            }
            for item in equipamentos
        ],
    }


def _tipos_documento_unicos(itens: list[dict]) -> None:
    vistos: set[str] = set()
    for item in itens:
        tipo = (item.get("tipo") or "").strip()
        if not tipo:
            continue
        chave = tipo.lower()
        if tipo != "Outros" and chave in vistos:
            raise HTTPException(
                status_code=400,
                detail=f"Documento civil duplicado: {tipo}",
            )
        if tipo != "Outros":
            vistos.add(chave)


def _tipos_substancia_unicos(itens: list[dict]) -> None:
    vistos: set[str] = set()
    for item in itens:
        tipo = (item.get("tipo") or "").strip()
        if not tipo:
            continue
        chave = tipo.lower()
        if chave in vistos:
            raise HTTPException(
                status_code=400,
                detail=f"Substância duplicada: {tipo}",
            )
        vistos.add(chave)


async def sincronizar_listas_ficha_pia(
    db: AsyncSession,
    convivente: ConviventeDB,
    instituicao_id: str,
    payload: dict[str, Any],
) -> None:
    if "familiares" in payload:
        await db.execute(
            delete(ConviventeFamiliarDB).where(ConviventeFamiliarDB.convivente_id == convivente.id)
        )
        for item in payload.get("familiares") or []:
            if not (item.get("parentesco") or "").strip():
                continue
            db.add(
                ConviventeFamiliarDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    parentesco=item.get("parentesco"),
                    parentesco_outros=item.get("parentesco_outros"),
                    nome=item.get("nome"),
                    idade=item.get("idade"),
                    cep=item.get("cep"),
                    logradouro=item.get("logradouro"),
                    numero=item.get("numero"),
                    complemento=item.get("complemento"),
                    bairro=item.get("bairro"),
                    cidade=item.get("cidade"),
                    uf=item.get("uf"),
                    endereco=item.get("endereco"),
                    telefone=item.get("telefone"),
                )
            )

    if "documentos_civis" in payload:
        itens = payload.get("documentos_civis") or []
        _tipos_documento_unicos(itens)
        await db.execute(
            delete(ConviventeDocumentoCivilDB).where(
                ConviventeDocumentoCivilDB.convivente_id == convivente.id
            )
        )
        for item in itens:
            if not (item.get("tipo") or "").strip():
                continue
            db.add(
                ConviventeDocumentoCivilDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    tipo=item.get("tipo"),
                    tipo_outros=item.get("tipo_outros"),
                    numero=item.get("numero"),
                    orientacoes=item.get("orientacoes"),
                )
            )

    if "substancias" in payload:
        itens = payload.get("substancias") or []
        _tipos_substancia_unicos(itens)
        await db.execute(
            delete(ConviventeSubstanciaDB).where(ConviventeSubstanciaDB.convivente_id == convivente.id)
        )
        for item in itens:
            if not (item.get("tipo") or "").strip():
                continue
            db.add(
                ConviventeSubstanciaDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    tipo=item.get("tipo"),
                    desde_quando=item.get("desde_quando"),
                    quantidade=item.get("quantidade"),
                )
            )

    if "medicamentos" in payload:
        await db.execute(
            delete(ConviventeMedicamentoDB).where(ConviventeMedicamentoDB.convivente_id == convivente.id)
        )
        for item in payload.get("medicamentos") or []:
            if not (item.get("nome") or "").strip():
                continue
            db.add(
                ConviventeMedicamentoDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    nome=item.get("nome"),
                    tempo_uso=item.get("tempo_uso"),
                    modo_uso=item.get("modo_uso"),
                )
            )

    if "internacoes" in payload:
        await db.execute(
            delete(ConviventeInternacaoDB).where(ConviventeInternacaoDB.convivente_id == convivente.id)
        )
        for item in payload.get("internacoes") or []:
            if not any(item.get(k) for k in ("onde", "periodo", "quem_encaminhou")):
                continue
            db.add(
                ConviventeInternacaoDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    onde=item.get("onde"),
                    periodo=item.get("periodo"),
                    quem_encaminhou=item.get("quem_encaminhou"),
                )
            )

    if "equipamentos_anteriores" in payload:
        await db.execute(
            delete(ConviventeEquipamentoAnteriorDB).where(
                ConviventeEquipamentoAnteriorDB.convivente_id == convivente.id
            )
        )
        for item in payload.get("equipamentos_anteriores") or []:
            if not item.get("origem_encaminhamento_id") and not (item.get("descricao_outros") or "").strip():
                continue
            db.add(
                ConviventeEquipamentoAnteriorDB(
                    id=item.get("id") or get_uuid(),
                    instituicao_id=instituicao_id,
                    convivente_id=convivente.id,
                    origem_encaminhamento_id=item.get("origem_encaminhamento_id") or None,
                    descricao_outros=item.get("descricao_outros"),
                )
            )


def enriquecer_convivente_response_dict(base: dict, listas: dict[str, list]) -> dict:
    base = {
        **base,
        **listas,
        "beneficios_pia": _parse_beneficios(base.get("beneficios_pia")),
        "situacoes_trabalho": _parse_situacoes_trabalho(base.get("situacoes_trabalho")),
    }
    return base


def normalizar_campos_ficha_payload(dados: dict[str, Any]) -> dict[str, Any]:
    if "beneficios_pia" in dados:
        dados["beneficios_pia"] = _dump_beneficios(dados.get("beneficios_pia"))
    if "situacoes_trabalho" in dados:
        dados["situacoes_trabalho"] = _dump_situacoes_trabalho(dados.get("situacoes_trabalho"))
    return dados
