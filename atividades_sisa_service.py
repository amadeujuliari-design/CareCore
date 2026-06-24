from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from atividades_sisa_catalogo import (
    SISA_CATALOGO_TEMAS_PADRAO,
    SISA_CATALOGO_TIPOS_PADRAO,
    TIPOS_CATALOGO_SISA,
)
from atividades_sisa_parser import normalizar_texto_sisa
from models import AtividadeCatalogoSisaDB
from routers.conviventes_helpers import agora_sao_paulo
from schemas import AtividadeCatalogoSisaItem, AtividadeCatalogoSisaResponse


async def _listar_catalogo_instituicao(
    db: AsyncSession,
    instituicao_id: str,
    tipo: str,
) -> list[AtividadeCatalogoSisaDB]:
    return list(
        (
            await db.execute(
                select(AtividadeCatalogoSisaDB)
                .where(
                    AtividadeCatalogoSisaDB.instituicao_id == instituicao_id,
                    AtividadeCatalogoSisaDB.tipo == tipo,
                )
                .order_by(AtividadeCatalogoSisaDB.valor.asc())
            )
        ).scalars().all()
    )


def _catalogo_padrao_por_tipo(tipo: str) -> list[str]:
    if tipo == "descricao_atividade":
        return list(SISA_CATALOGO_TIPOS_PADRAO)
    if tipo == "descricao_tema":
        return list(SISA_CATALOGO_TEMAS_PADRAO)
    return []


async def montar_catalogo_sisa_response(
    db: AsyncSession,
    instituicao_id: str,
) -> AtividadeCatalogoSisaResponse:
    personalizados_tipo = await _listar_catalogo_instituicao(db, instituicao_id, "descricao_atividade")
    personalizados_tema = await _listar_catalogo_instituicao(db, instituicao_id, "descricao_tema")

    def mesclar(tipo: str, personalizados: list[AtividadeCatalogoSisaDB]) -> list[AtividadeCatalogoSisaItem]:
        vistos: set[str] = set()
        itens: list[AtividadeCatalogoSisaItem] = []
        for valor in _catalogo_padrao_por_tipo(tipo):
            norm = normalizar_texto_sisa(valor)
            if norm in vistos:
                continue
            vistos.add(norm)
            itens.append(AtividadeCatalogoSisaItem(valor=valor, personalizado=False))
        for registro in personalizados:
            if registro.valor_norm in vistos:
                continue
            vistos.add(registro.valor_norm)
            itens.append(AtividadeCatalogoSisaItem(valor=registro.valor, personalizado=True))
        return sorted(itens, key=lambda item: item.valor)

    return AtividadeCatalogoSisaResponse(
        descricao_atividade=mesclar("descricao_atividade", personalizados_tipo),
        descricao_tema=mesclar("descricao_tema", personalizados_tema),
    )


async def registrar_catalogo_sisa_se_necessario(
    db: AsyncSession,
    *,
    instituicao_id: str,
    usuario_id: str | None,
    tipo: str,
    valor: str | None,
    somente_personalizado: bool = True,
) -> None:
    if not valor or not str(valor).strip():
        return
    if tipo not in TIPOS_CATALOGO_SISA:
        return

    valor_limpo = str(valor).strip()
    valor_norm = normalizar_texto_sisa(valor_limpo)
    if not valor_norm:
        return

    padrao = {normalizar_texto_sisa(item) for item in _catalogo_padrao_por_tipo(tipo)}
    if somente_personalizado and valor_norm in padrao:
        return

    existente = (
        await db.execute(
            select(AtividadeCatalogoSisaDB).where(
                AtividadeCatalogoSisaDB.instituicao_id == instituicao_id,
                AtividadeCatalogoSisaDB.tipo == tipo,
                AtividadeCatalogoSisaDB.valor_norm == valor_norm,
            )
        )
    ).scalar_one_or_none()
    if existente:
        return

    db.add(
        AtividadeCatalogoSisaDB(
            instituicao_id=instituicao_id,
            tipo=tipo,
            valor=valor_limpo,
            valor_norm=valor_norm,
            personalizado=valor_norm not in padrao,
            criado_por_id=usuario_id,
            criado_em=agora_sao_paulo(),
        )
    )


async def registrar_catalogos_de_atividade(
    db: AsyncSession,
    *,
    instituicao_id: str,
    usuario_id: str | None,
    descricao_atividade: str | None,
    descricao_tema: str | None,
) -> None:
    await registrar_catalogo_sisa_se_necessario(
        db,
        instituicao_id=instituicao_id,
        usuario_id=usuario_id,
        tipo="descricao_atividade",
        valor=descricao_atividade,
    )
    await registrar_catalogo_sisa_se_necessario(
        db,
        instituicao_id=instituicao_id,
        usuario_id=usuario_id,
        tipo="descricao_tema",
        valor=descricao_tema,
    )
