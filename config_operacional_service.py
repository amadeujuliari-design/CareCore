"""Carregamento da configuração operacional por instituição."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config_operacional import ConfigOperacionalProjeto, mesclar_config_operacional, serializar_config_operacional
from config_operacional_projeto import projeto_usa_defaults_siat
from models import InstituicaoDB


def perfil_defaults_projeto(projeto: InstituicaoDB | None) -> str:
    return "siat" if projeto_usa_defaults_siat(projeto) else "generico"


async def carregar_config_operacional_instituicao(
    db: AsyncSession,
    instituicao_id: str,
) -> tuple[ConfigOperacionalProjeto, bool, str]:
    resultado = await db.execute(
        select(InstituicaoDB).where(InstituicaoDB.id == instituicao_id)
    )
    projeto = resultado.scalar_one_or_none()
    perfil = perfil_defaults_projeto(projeto)
    if not projeto:
        return mesclar_config_operacional(None, siat=False), False, perfil

    personalizado = bool((projeto.config_operacional_json or "").strip())
    usa_siat = perfil == "siat"
    config = mesclar_config_operacional(projeto.config_operacional_json, siat=usa_siat)
    return config, personalizado, perfil


async def salvar_config_operacional_instituicao(
    db: AsyncSession,
    projeto: InstituicaoDB,
    config: ConfigOperacionalProjeto,
) -> tuple[ConfigOperacionalProjeto, str]:
    projeto.config_operacional_json = serializar_config_operacional(config)
    projeto.historico_legado_ativo = bool(config.modulos.historico_legado)
    await db.commit()
    await db.refresh(projeto)
    perfil = perfil_defaults_projeto(projeto)
    return mesclar_config_operacional(projeto.config_operacional_json, siat=perfil == "siat"), perfil
