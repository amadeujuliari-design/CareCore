import logging
import os
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import InstituicaoDB, UsuarioDB
from security import PERFIL_MANUTENCAO, email_usuario_manutencao, gerar_hash_senha


logger = logging.getLogger("carecore.manutencao")


def manutencao_habilitada() -> bool:
    return os.getenv("CARECORE_MANUTENCAO_ATIVO", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "sim",
    }


def senha_manutencao_configurada() -> str:
    return os.getenv("CARECORE_MANUTENCAO_PASSWORD", "").strip()


async def provisionar_usuario_manutencao(db: AsyncSession) -> None:
    if not manutencao_habilitada():
        return

    email = email_usuario_manutencao()
    senha = senha_manutencao_configurada()

    if not senha:
        logger.warning(
            "Usuário de manutenção não provisionado: CARECORE_MANUTENCAO_PASSWORD ausente."
        )
        return

    resultado_projeto = await db.execute(
        select(InstituicaoDB).order_by(InstituicaoDB.nome_fantasia.asc(), InstituicaoDB.id.asc())
    )
    projeto_base = resultado_projeto.scalars().first()

    if not projeto_base:
        return

    resultado_usuario = await db.execute(
        select(UsuarioDB).where(UsuarioDB.email == email)
    )
    usuario = resultado_usuario.scalar_one_or_none()

    if usuario:
        usuario.nome = os.getenv("CARECORE_MANUTENCAO_NOME", "Manutenção CareCore+").strip()
        usuario.instituicao_id = projeto_base.id
        usuario.organizacao_id = getattr(projeto_base, "organizacao_id", None)
        usuario.perfil_acesso = PERFIL_MANUTENCAO
        usuario.is_master = True
        usuario.is_global = True
        usuario.ativo = True
        usuario.atualizado_em = datetime.utcnow()
        return

    db.add(
        UsuarioDB(
            instituicao_id=projeto_base.id,
            organizacao_id=getattr(projeto_base, "organizacao_id", None),
            nome=os.getenv("CARECORE_MANUTENCAO_NOME", "Manutenção CareCore+").strip(),
            email=email,
            senha_hash=gerar_hash_senha(senha),
            perfil_acesso=PERFIL_MANUTENCAO,
            is_master=True,
            is_global=True,
            ativo=True,
            cargo="Suporte técnico CareCore+",
            setor="Manutenção",
            criado_em=datetime.utcnow(),
        )
    )
