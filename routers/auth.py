# =====================================================================
# ARQUIVO: routers/auth.py
# CARECORE+ OFICIAL
# FASE 1B — Autenticação, onboarding seguro e bloqueio de usuário inativo
# =====================================================================

from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import UsuarioDB, InstituicaoDB
from schemas import (
    LoginPayload,
    OnboardingPayload,
    Token,
)

from security import (
    verificar_senha,
    gerar_hash_senha,
    criar_access_token,
    normalizar_perfil_acesso,
)


router = APIRouter(
    prefix="/api",
    tags=["Autenticação"],
)


# =====================================================================
# HELPERS
# =====================================================================

def agora_utc_sem_timezone() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def verificar_email_unico(
    db: AsyncSession,
    email: str,
) -> None:
    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.email == email.lower().strip()
        )
    )

    usuario_existente = resultado.scalar_one_or_none()

    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um usuário com este e-mail.",
        )


async def verificar_cpf_unico(
    db: AsyncSession,
    cpf: str | None,
) -> None:
    if not cpf:
        return

    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.cpf == cpf
        )
    )

    usuario_existente = resultado.scalar_one_or_none()

    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um usuário com este CPF.",
        )


def montar_payload_token(usuario: UsuarioDB) -> dict:
    perfil_acesso = normalizar_perfil_acesso(
        getattr(usuario, "perfil_acesso", None)
    )

    return {
        "sub": usuario.id,
        "id": usuario.id,
        "usuario_id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "instituicao_id": usuario.instituicao_id,
        "perfil_acesso": perfil_acesso,
        "is_master": bool(getattr(usuario, "is_master", False)),
        "ativo": bool(getattr(usuario, "ativo", True)),
    }


# =====================================================================
# LOGIN
# =====================================================================

@router.post("/login", response_model=Token)
async def login(
    payload: LoginPayload,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower().strip()

    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.email == email
        )
    )

    usuario = resultado.scalar_one_or_none()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    if not verificar_senha(
        payload.senha,
        usuario.senha_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    if not bool(getattr(usuario, "ativo", True)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Acesso bloqueado.",
        )

    usuario.ultimo_login_em = agora_utc_sem_timezone()

    await db.commit()
    await db.refresh(usuario)

    token = criar_access_token(
        data=montar_payload_token(usuario),
        expires_delta=timedelta(hours=12),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": usuario,
    }


# =====================================================================
# ONBOARDING
# =====================================================================

@router.post("/onboarding")
async def onboarding(
    payload: OnboardingPayload,
    db: AsyncSession = Depends(get_db),
):
    email = payload.usuario_master.email.lower().strip()
    cpf = payload.usuario_master.cpf

    await verificar_email_unico(db, email)
    await verificar_cpf_unico(db, cpf)

    instituicao = InstituicaoDB(
        nome_fantasia=payload.instituicao.nome_fantasia,
        cnpj=payload.instituicao.cnpj,
        telefone=payload.instituicao.telefone,
    )

    db.add(instituicao)
    await db.flush()

    usuario_master = UsuarioDB(
        instituicao_id=instituicao.id,
        nome=payload.usuario_master.nome,
        email=email,
        cpf=payload.usuario_master.cpf,
        telefone=payload.usuario_master.telefone,
        avatar_url=payload.usuario_master.avatar_url,
        senha_hash=gerar_hash_senha(
            payload.usuario_master.senha
        ),
        perfil_acesso="Gestor",
        is_master=True,
        ativo=True,
        data_nascimento=payload.usuario_master.data_nascimento,
        genero=payload.usuario_master.genero,
        rg=payload.usuario_master.rg,
        orgao_emissor=payload.usuario_master.orgao_emissor,
        estado_civil=payload.usuario_master.estado_civil,
        nacionalidade=payload.usuario_master.nacionalidade,
        naturalidade=payload.usuario_master.naturalidade,
        cep=payload.usuario_master.cep,
        logradouro=payload.usuario_master.logradouro,
        numero=payload.usuario_master.numero,
        complemento=payload.usuario_master.complemento,
        bairro=payload.usuario_master.bairro,
        cidade=payload.usuario_master.cidade,
        uf=payload.usuario_master.uf,
        cargo=payload.usuario_master.cargo,
        setor=payload.usuario_master.setor,
        conselho_profissional=payload.usuario_master.conselho_profissional,
        numero_conselho=payload.usuario_master.numero_conselho,
        carga_horaria=payload.usuario_master.carga_horaria,
        data_admissao=payload.usuario_master.data_admissao,
        observacoes_profissionais=payload.usuario_master.observacoes_profissionais,
        criado_em=agora_utc_sem_timezone(),
    )

    db.add(usuario_master)

    try:
        await db.commit()

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao realizar onboarding: {str(erro)}",
        )

    return {
        "message": "Onboarding realizado com sucesso.",
    }
