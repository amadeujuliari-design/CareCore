# =====================================================================
# ARQUIVO: routers/auth.py
# CARECORE+ OFICIAL
# FASE 1B — Autenticação, onboarding seguro e bloqueio de usuário inativo
# =====================================================================

from datetime import timedelta, datetime, timezone
import hashlib
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config_utils import env_bool, env_int
from database import get_db
from audit_log import registrar_evento_auditoria
from models import OrganizacaoDB, UsuarioDB, InstituicaoDB
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
    usuario_eh_manutencao,
)

try:
    import redis.asyncio as redis_async
except ImportError:  # pragma: no cover - dependência opcional em ambiente local antigo.
    redis_async = None


router = APIRouter(
    prefix="/api",
    tags=["Autenticação"],
)

logger = logging.getLogger("carecore.auth")
APP_ENV = os.getenv("APP_ENV", "local").strip().lower()
ONBOARDING_PUBLICO_PADRAO = "false" if APP_ENV in {"production", "prod"} else "true"
ONBOARDING_PUBLICO = env_bool("CARECORE_ONBOARDING_PUBLICO", ONBOARDING_PUBLICO_PADRAO)
LOGIN_MAX_TENTATIVAS = env_int("CARECORE_LOGIN_MAX_TENTATIVAS", 8, minimo=0)
LOGIN_JANELA_SEGUNDOS = env_int("CARECORE_LOGIN_JANELA_SEGUNDOS", 900, minimo=1)
LOGIN_BLOQUEIO_SEGUNDOS = env_int("CARECORE_LOGIN_BLOQUEIO_SEGUNDOS", 900, minimo=1)
LOGIN_MAX_CHAVES_CACHE = env_int("CARECORE_LOGIN_MAX_CHAVES_CACHE", 5000, minimo=0)
RATE_LIMIT_REDIS_URL = os.getenv("CARECORE_RATE_LIMIT_REDIS_URL", "").strip()
_tentativas_login: dict[str, list[datetime]] = {}
_redis_rate_limit_client = None


# =====================================================================
# HELPERS
# =====================================================================

def agora_utc_sem_timezone() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def obter_ip_cliente(request: Request) -> str:
    encaminhado = request.headers.get("x-forwarded-for", "")
    if encaminhado:
        return encaminhado.split(",", 1)[0].strip()

    return request.client.host if request.client else "desconhecido"


def dominio_email(email: str) -> str | None:
    partes = email.lower().strip().rsplit("@", 1)
    return partes[1] if len(partes) == 2 else None


def chave_tentativa_login(request: Request, email: str) -> str:
    return f"{obter_ip_cliente(request)}:{email.lower().strip()}"


def chave_tentativa_login_redis(request: Request, email: str) -> str:
    chave_bruta = chave_tentativa_login(request, email)
    digest = hashlib.sha256(chave_bruta.encode("utf-8")).hexdigest()
    return f"carecore:login-rate-limit:{digest}"


def obter_cliente_redis_rate_limit():
    global _redis_rate_limit_client

    if not RATE_LIMIT_REDIS_URL or redis_async is None:
        return None

    if _redis_rate_limit_client is None:
        _redis_rate_limit_client = redis_async.from_url(
            RATE_LIMIT_REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )

    return _redis_rate_limit_client


async def verificar_limite_login_redis(request: Request, email: str) -> bool:
    cliente = obter_cliente_redis_rate_limit()
    if cliente is None:
        return False

    chave_base = chave_tentativa_login_redis(request, email)
    chave_bloqueio = f"{chave_base}:blocked"

    try:
        bloqueado = await cliente.exists(chave_bloqueio)
    except Exception as erro:
        logger.warning(
            "Rate limit Redis indisponível; usando fallback local",
            extra={"rate_limit_backend": "redis", "erro": str(erro)},
        )
        return False

    if bloqueado:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        )

    return True


async def registrar_falha_login_redis(request: Request, email: str) -> bool:
    cliente = obter_cliente_redis_rate_limit()
    if cliente is None:
        return False

    chave_base = chave_tentativa_login_redis(request, email)
    chave_bloqueio = f"{chave_base}:blocked"

    try:
        total = await cliente.incr(chave_base)
        if total == 1:
            await cliente.expire(chave_base, LOGIN_JANELA_SEGUNDOS)

        if total >= LOGIN_MAX_TENTATIVAS:
            await cliente.set(chave_bloqueio, "1", ex=LOGIN_BLOQUEIO_SEGUNDOS)

        return True
    except Exception as erro:
        logger.warning(
            "Falha ao registrar rate limit no Redis; usando fallback local",
            extra={"rate_limit_backend": "redis", "erro": str(erro)},
        )
        return False


async def limpar_falhas_login_redis(request: Request, email: str) -> bool:
    cliente = obter_cliente_redis_rate_limit()
    if cliente is None:
        return False

    chave_base = chave_tentativa_login_redis(request, email)
    chave_bloqueio = f"{chave_base}:blocked"

    try:
        await cliente.delete(chave_base, chave_bloqueio)
        return True
    except Exception as erro:
        logger.warning(
            "Falha ao limpar rate limit no Redis; usando fallback local",
            extra={"rate_limit_backend": "redis", "erro": str(erro)},
        )
        return False


def limpar_tentativas_antigas(chave: str, agora: datetime) -> list[datetime]:
    limite = agora - timedelta(seconds=LOGIN_JANELA_SEGUNDOS)
    tentativas = [
        tentativa
        for tentativa in _tentativas_login.get(chave, [])
        if tentativa >= limite
    ]

    if tentativas:
        _tentativas_login[chave] = tentativas
    else:
        _tentativas_login.pop(chave, None)

    return tentativas


def limitar_cache_tentativas_login(agora: datetime) -> None:
    if not _tentativas_login:
        return

    for chave in list(_tentativas_login.keys()):
        limpar_tentativas_antigas(chave, agora)

    if LOGIN_MAX_CHAVES_CACHE <= 0 or len(_tentativas_login) <= LOGIN_MAX_CHAVES_CACHE:
        return

    chaves_por_atividade = sorted(
        _tentativas_login,
        key=lambda chave: max(_tentativas_login[chave]) if _tentativas_login[chave] else datetime.min,
    )
    excedente = len(_tentativas_login) - LOGIN_MAX_CHAVES_CACHE

    for chave in chaves_por_atividade[:excedente]:
        _tentativas_login.pop(chave, None)


def verificar_limite_login_local(request: Request, email: str) -> None:
    if LOGIN_MAX_TENTATIVAS <= 0:
        return

    agora = agora_utc_sem_timezone()
    limitar_cache_tentativas_login(agora)
    chave = chave_tentativa_login(request, email)
    tentativas = limpar_tentativas_antigas(chave, agora)

    if len(tentativas) < LOGIN_MAX_TENTATIVAS:
        return

    ultima_tentativa = max(tentativas)
    desbloqueio = ultima_tentativa + timedelta(seconds=LOGIN_BLOQUEIO_SEGUNDOS)

    if agora < desbloqueio:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        )

    _tentativas_login.pop(chave, None)


def registrar_falha_login_local(request: Request, email: str) -> None:
    if LOGIN_MAX_TENTATIVAS <= 0:
        return

    agora = agora_utc_sem_timezone()
    limitar_cache_tentativas_login(agora)
    chave = chave_tentativa_login(request, email)
    tentativas = limpar_tentativas_antigas(chave, agora)
    tentativas.append(agora)
    _tentativas_login[chave] = tentativas


def limpar_falhas_login_local(request: Request, email: str) -> None:
    _tentativas_login.pop(chave_tentativa_login(request, email), None)


async def verificar_limite_login(request: Request, email: str) -> None:
    if LOGIN_MAX_TENTATIVAS <= 0:
        return

    if await verificar_limite_login_redis(request, email):
        return

    verificar_limite_login_local(request, email)


async def registrar_falha_login(request: Request, email: str) -> None:
    if LOGIN_MAX_TENTATIVAS <= 0:
        return

    if await registrar_falha_login_redis(request, email):
        return

    registrar_falha_login_local(request, email)


async def limpar_falhas_login(request: Request, email: str) -> None:
    if await limpar_falhas_login_redis(request, email):
        return

    limpar_falhas_login_local(request, email)


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


def montar_payload_token(usuario: UsuarioDB, projeto: InstituicaoDB | None = None) -> dict:
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
        "organizacao_id": getattr(usuario, "organizacao_id", None),
        "projeto_nome": getattr(projeto, "nome_fantasia", None),
        "perfil_acesso": perfil_acesso,
        "is_master": bool(getattr(usuario, "is_master", False)),
        "is_global": bool(getattr(usuario, "is_global", False)),
        "is_manutencao": usuario_eh_manutencao(usuario),
        "ativo": bool(getattr(usuario, "ativo", True)),
        "token_version": int(getattr(usuario, "token_version", 0) or 0),
    }


# =====================================================================
# LOGIN
# =====================================================================

@router.post("/login", response_model=Token)
async def login(
    payload: LoginPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower().strip()
    await verificar_limite_login(request, email)

    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.email == email
        )
    )

    usuario = resultado.scalar_one_or_none()

    if not usuario:
        await registrar_falha_login(request, email)
        registrar_evento_auditoria(
            "login_falha",
            ip=obter_ip_cliente(request),
            email_dominio=dominio_email(email),
            motivo="usuario_ou_senha_invalidos",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    if not verificar_senha(
        payload.senha,
        usuario.senha_hash,
    ):
        await registrar_falha_login(request, email)
        registrar_evento_auditoria(
            "login_falha",
            ip=obter_ip_cliente(request),
            email_dominio=dominio_email(email),
            motivo="usuario_ou_senha_invalidos",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    if not bool(getattr(usuario, "ativo", True)):
        registrar_evento_auditoria(
            "login_bloqueado_usuario_inativo",
            usuario_id=usuario.id,
            instituicao_id=usuario.instituicao_id,
            organizacao_id=getattr(usuario, "organizacao_id", None),
            perfil_acesso=getattr(usuario, "perfil_acesso", None),
            ip=obter_ip_cliente(request),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Acesso bloqueado.",
        )

    usuario.ultimo_login_em = agora_utc_sem_timezone()
    await limpar_falhas_login(request, email)

    await db.commit()
    await db.refresh(usuario)

    projeto_resultado = await db.execute(
        select(InstituicaoDB).where(InstituicaoDB.id == usuario.instituicao_id)
    )
    projeto = projeto_resultado.scalar_one_or_none()

    registrar_evento_auditoria(
        "login_sucesso",
        usuario_id=usuario.id,
        instituicao_id=usuario.instituicao_id,
        organizacao_id=getattr(usuario, "organizacao_id", None),
        perfil_acesso=getattr(usuario, "perfil_acesso", None),
        ip=obter_ip_cliente(request),
    )

    token = criar_access_token(
        data=montar_payload_token(usuario, projeto),
        expires_delta=timedelta(hours=12),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            **montar_payload_token(usuario, projeto),
            "avatar_url": getattr(usuario, "avatar_url", None),
        },
    }


# =====================================================================
# ONBOARDING
# =====================================================================

@router.post("/onboarding")
async def onboarding(
    payload: OnboardingPayload,
    db: AsyncSession = Depends(get_db),
):
    if not ONBOARDING_PUBLICO:
        registrar_evento_auditoria("onboarding_publico_bloqueado")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cadastro público indisponível neste ambiente.",
        )

    email = payload.usuario_master.email.lower().strip()
    cpf = payload.usuario_master.cpf

    await verificar_email_unico(db, email)
    await verificar_cpf_unico(db, cpf)

    organizacao_payload = payload.organizacao
    projeto_payload = payload.projeto or payload.instituicao

    if organizacao_payload is None and payload.instituicao is not None:
        organizacao_payload = OrganizacaoDB(
            nome=payload.instituicao.nome_fantasia,
            cnpj=payload.instituicao.cnpj,
            telefone=payload.instituicao.telefone,
        )
    else:
        organizacao_payload = OrganizacaoDB(
            nome=payload.organizacao.nome,
            cnpj=payload.organizacao.cnpj,
            telefone=payload.organizacao.telefone,
            email=payload.organizacao.email,
            cep=payload.organizacao.cep,
            logradouro=payload.organizacao.logradouro,
            numero=payload.organizacao.numero,
            complemento=payload.organizacao.complemento,
            bairro=payload.organizacao.bairro,
            cidade=payload.organizacao.cidade,
            uf=payload.organizacao.uf,
        )

    db.add(organizacao_payload)
    await db.flush()

    instituicao = InstituicaoDB(
        organizacao_id=organizacao_payload.id,
        nome_fantasia=projeto_payload.nome_fantasia,
        cnpj=projeto_payload.cnpj,
        telefone=projeto_payload.telefone,
        email=projeto_payload.email,
        cep=projeto_payload.cep,
        logradouro=projeto_payload.logradouro,
        numero=projeto_payload.numero,
        complemento=projeto_payload.complemento,
        bairro=projeto_payload.bairro,
        cidade=projeto_payload.cidade,
        uf=projeto_payload.uf,
        tipo_projeto=projeto_payload.tipo_projeto or "Projeto",
        projeto_unico=payload.projeto_unico,
    )

    db.add(instituicao)
    await db.flush()

    perfil_usuario_inicial = "Gestor" if payload.projeto_unico else "Global"

    usuario_master = UsuarioDB(
        instituicao_id=instituicao.id,
        organizacao_id=organizacao_payload.id,
        nome=payload.usuario_master.nome,
        email=email,
        cpf=payload.usuario_master.cpf,
        telefone=payload.usuario_master.telefone,
        avatar_url=payload.usuario_master.avatar_url,
        senha_hash=gerar_hash_senha(
            payload.usuario_master.senha
        ),
        perfil_acesso=perfil_usuario_inicial,
        is_master=payload.projeto_unico,
        is_global=True,
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
        registrar_evento_auditoria(
            "onboarding_sucesso",
            organizacao_id=organizacao_payload.id,
            instituicao_id=instituicao.id,
            usuario_id=usuario_master.id,
            projeto_unico=payload.projeto_unico,
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível realizar o onboarding. Verifique os dados informados.",
        ) from erro

    return {
        "message": "Onboarding realizado com sucesso.",
    }
