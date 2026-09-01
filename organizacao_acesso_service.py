"""Controle de acesso a organizações (Manutenção / Manutenção2 futuro)."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import InstituicaoDB, OrganizacaoDB, UsuarioOrganizacaoAcessoDB
from organizacao_pacote import normalizar_tipo_pacote


async def _ids_acesso_explicito(db: AsyncSession, usuario_id: str) -> list[str]:
    resultado = await db.execute(
        select(UsuarioOrganizacaoAcessoDB.organizacao_id).where(
            UsuarioOrganizacaoAcessoDB.usuario_id == usuario_id,
        )
    )
    return [row[0] for row in resultado.all()]


async def usuario_pode_acessar_organizacao(
    db: AsyncSession,
    *,
    usuario_id: str,
    organizacao_id: str,
    is_manutencao: bool,
) -> bool:
    if not is_manutencao:
        return False

    ids_explicitos = await _ids_acesso_explicito(db, usuario_id)
    if ids_explicitos:
        return organizacao_id in ids_explicitos

    resultado = await db.execute(
        select(OrganizacaoDB.id).where(
            OrganizacaoDB.id == organizacao_id,
            OrganizacaoDB.is_active == True,  # noqa: E712
        )
    )
    return resultado.scalar_one_or_none() is not None


async def listar_organizacoes_acessiveis(
    db: AsyncSession,
    *,
    usuario_id: str,
    is_manutencao: bool,
) -> list[dict]:
    if not is_manutencao:
        return []

    ids_explicitos = await _ids_acesso_explicito(db, usuario_id)

    consulta = select(OrganizacaoDB).where(OrganizacaoDB.is_active == True)  # noqa: E712
    if ids_explicitos:
        consulta = consulta.where(OrganizacaoDB.id.in_(ids_explicitos))

    consulta = consulta.order_by(OrganizacaoDB.nome)
    resultado = await db.execute(consulta)
    organizacoes = resultado.scalars().all()

    if not organizacoes:
        return []

    org_ids = [org.id for org in organizacoes]
    resultado_projetos = await db.execute(
        select(
            InstituicaoDB.organizacao_id,
            func.count(InstituicaoDB.id),
        )
        .where(
            InstituicaoDB.organizacao_id.in_(org_ids),
            InstituicaoDB.is_active == True,  # noqa: E712
        )
        .group_by(InstituicaoDB.organizacao_id)
    )
    contagem_por_org = {org_id: int(total) for org_id, total in resultado_projetos.all()}

    return [
        {
            "id": org.id,
            "nome": org.nome,
            "tipo_pacote": normalizar_tipo_pacote(getattr(org, "tipo_pacote", None)),
            "is_active": bool(org.is_active),
            "projetos_ativos": contagem_por_org.get(org.id, 0),
        }
        for org in organizacoes
    ]


async def obter_projeto_padrao_organizacao(
    db: AsyncSession,
    organizacao_id: str,
) -> InstituicaoDB | None:
    resultado = await db.execute(
        select(InstituicaoDB)
        .where(
            InstituicaoDB.organizacao_id == organizacao_id,
            InstituicaoDB.is_active == True,  # noqa: E712
        )
        .order_by(InstituicaoDB.nome_fantasia)
        .limit(1)
    )
    return resultado.scalar_one_or_none()
