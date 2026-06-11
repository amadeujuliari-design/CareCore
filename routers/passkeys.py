import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from audit_log import registrar_evento_auditoria
from database import get_db
from models import InstituicaoDB, UsuarioDB, UsuarioPasskeyDB
from schemas import (
    PasskeyDispositivoResponse,
    PasskeyLoginOptionsPayload,
    PasskeyLoginVerifyPayload,
    PasskeyOptionsResponse,
    PasskeyRegistroVerifyPayload,
    Token,
)
from security import (
    ALGORITHM,
    SECRET_KEY,
    criar_access_token,
    get_usuario_logado,
)
from routers.auth import montar_payload_token, obter_ip_cliente


router = APIRouter(prefix="/api/passkeys", tags=["Passkeys"])

RP_NAME = os.getenv("CARECORE_WEBAUTHN_RP_NAME", "CareCore+")
RP_ID_CONFIGURADO = os.getenv("CARECORE_WEBAUTHN_RP_ID", "").strip()
CHALLENGE_TTL_MINUTOS = 5


def agora_utc_sem_timezone() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def base64url_encode(valor: bytes) -> str:
    return base64.urlsafe_b64encode(valor).decode("ascii").rstrip("=")


def base64url_decode(valor: str) -> bytes:
    padding = "=" * (-len(valor) % 4)
    return base64.urlsafe_b64decode((valor + padding).encode("ascii"))


def origem_requisicao(request: Request) -> str:
    origem = request.headers.get("origin") or request.headers.get("referer")
    if origem:
        parsed = urlparse(origem)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"

    # Fallback útil para desenvolvimento local e testes diretos.
    return str(request.base_url).rstrip("/")


def rp_id_requisicao(request: Request) -> str:
    if RP_ID_CONFIGURADO:
        return RP_ID_CONFIGURADO

    parsed = urlparse(origem_requisicao(request))
    host = parsed.hostname or request.url.hostname or "localhost"
    return host


def criar_challenge_token(
    *,
    tipo: str,
    challenge: bytes,
    rp_id: str,
    origin: str,
    usuario_id: str | None = None,
    email: str | None = None,
) -> str:
    payload = {
        "tipo": tipo,
        "challenge": base64url_encode(challenge),
        "rp_id": rp_id,
        "origin": origin,
        "usuario_id": usuario_id,
        "email": email,
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=CHALLENGE_TTL_MINUTOS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def ler_challenge_token(token: str, tipo: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solicitação de biometria expirada. Tente novamente.",
        ) from erro
    except jwt.InvalidTokenError as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solicitação de biometria inválida.",
        ) from erro

    if payload.get("tipo") != tipo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solicitação de biometria incompatível.",
        )

    return payload


def credenciais_excluidas(passkeys: list[UsuarioPasskeyDB]) -> list[PublicKeyCredentialDescriptor]:
    return [
        PublicKeyCredentialDescriptor(id=base64url_decode(passkey.credential_id))
        for passkey in passkeys
        if passkey.ativo
    ]


def credenciais_permitidas(passkeys: list[UsuarioPasskeyDB]) -> list[PublicKeyCredentialDescriptor]:
    return [
        PublicKeyCredentialDescriptor(id=base64url_decode(passkey.credential_id))
        for passkey in passkeys
        if passkey.ativo
    ]


async def buscar_usuario_ativo_por_email(db: AsyncSession, email: str) -> UsuarioDB:
    resultado = await db.execute(
        select(UsuarioDB).where(UsuarioDB.email == email.lower().strip())
    )
    usuario = resultado.scalar_one_or_none()

    if not usuario or not bool(getattr(usuario, "ativo", True)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível entrar com biometria neste e-mail.",
        )

    return usuario


async def buscar_projeto_usuario(db: AsyncSession, usuario: UsuarioDB) -> InstituicaoDB | None:
    resultado = await db.execute(
        select(InstituicaoDB).where(InstituicaoDB.id == usuario.instituicao_id)
    )
    return resultado.scalar_one_or_none()


@router.get("/me", response_model=list[PasskeyDispositivoResponse])
async def listar_minhas_passkeys(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    resultado = await db.execute(
        select(UsuarioPasskeyDB)
        .where(
            UsuarioPasskeyDB.usuario_id == usuario_atual["id"],
            UsuarioPasskeyDB.ativo == True,  # noqa: E712
        )
        .order_by(UsuarioPasskeyDB.criado_em.desc())
    )
    return resultado.scalars().all()


@router.post("/registro/options", response_model=PasskeyOptionsResponse)
async def criar_opcoes_registro_passkey(
    request: Request,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    resultado = await db.execute(
        select(UsuarioPasskeyDB).where(
            UsuarioPasskeyDB.usuario_id == usuario_atual["id"],
            UsuarioPasskeyDB.ativo == True,  # noqa: E712
        )
    )
    passkeys = resultado.scalars().all()
    rp_id = rp_id_requisicao(request)
    origin = origem_requisicao(request)

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=RP_NAME,
        user_id=usuario_atual["id"].encode("utf-8"),
        user_name=usuario_atual["email"],
        user_display_name=usuario_atual["nome"],
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=credenciais_excluidas(passkeys),
    )

    return {
        "publicKey": json.loads(options_to_json(options)),
        "challenge_token": criar_challenge_token(
            tipo="registro",
            challenge=options.challenge,
            rp_id=rp_id,
            origin=origin,
            usuario_id=usuario_atual["id"],
        ),
    }


@router.post("/registro/verify", response_model=PasskeyDispositivoResponse)
async def verificar_registro_passkey(
    payload: PasskeyRegistroVerifyPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    token_payload = ler_challenge_token(payload.challenge_token, "registro")

    if token_payload.get("usuario_id") != usuario_atual["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta solicitação de biometria não pertence ao usuário logado.",
        )

    try:
        verificacao = verify_registration_response(
            credential=payload.credential,
            expected_challenge=base64url_decode(token_payload["challenge"]),
            expected_rp_id=token_payload["rp_id"],
            expected_origin=token_payload["origin"],
            require_user_verification=True,
        )
    except Exception as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível validar a biometria deste aparelho.",
        ) from erro

    credential_id = base64url_encode(verificacao.credential_id)
    existente = await db.execute(
        select(UsuarioPasskeyDB).where(UsuarioPasskeyDB.credential_id == credential_id)
    )
    passkey_existente = existente.scalar_one_or_none()

    if passkey_existente and passkey_existente.ativo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este aparelho já está vinculado para acesso biométrico.",
        )

    passkey = UsuarioPasskeyDB(
        usuario_id=usuario_atual["id"],
        instituicao_id=usuario_atual["instituicao_id"],
        organizacao_id=usuario_atual.get("organizacao_id"),
        credential_id=credential_id,
        public_key=base64url_encode(verificacao.credential_public_key),
        sign_count=verificacao.sign_count,
        transports=json.dumps(payload.credential.get("response", {}).get("transports", [])),
        nome_dispositivo=(payload.nome_dispositivo or "").strip()[:80] or "Este aparelho",
        user_agent=request.headers.get("user-agent"),
        ativo=True,
        criado_em=agora_utc_sem_timezone(),
    )
    db.add(passkey)
    await db.commit()
    await db.refresh(passkey)

    registrar_evento_auditoria(
        "passkey_registrada",
        usuario_id=usuario_atual["id"],
        instituicao_id=usuario_atual["instituicao_id"],
        organizacao_id=usuario_atual.get("organizacao_id"),
        ip=obter_ip_cliente(request),
    )

    return passkey


@router.post("/login/options", response_model=PasskeyOptionsResponse)
async def criar_opcoes_login_passkey(
    payload: PasskeyLoginOptionsPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    usuario = await buscar_usuario_ativo_por_email(db, payload.email)
    resultado = await db.execute(
        select(UsuarioPasskeyDB).where(
            UsuarioPasskeyDB.usuario_id == usuario.id,
            UsuarioPasskeyDB.ativo == True,  # noqa: E712
        )
    )
    passkeys = resultado.scalars().all()

    if not passkeys:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhum acesso biométrico foi ativado para este usuário.",
        )

    rp_id = rp_id_requisicao(request)
    origin = origem_requisicao(request)
    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=credenciais_permitidas(passkeys),
        user_verification=UserVerificationRequirement.REQUIRED,
    )

    return {
        "publicKey": json.loads(options_to_json(options)),
        "challenge_token": criar_challenge_token(
            tipo="login",
            challenge=options.challenge,
            rp_id=rp_id,
            origin=origin,
            email=payload.email,
        ),
    }


@router.post("/login/verify", response_model=Token)
async def verificar_login_passkey(
    payload: PasskeyLoginVerifyPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token_payload = ler_challenge_token(payload.challenge_token, "login")

    if token_payload.get("email") != payload.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solicitação de biometria incompatível com o e-mail informado.",
        )

    usuario = await buscar_usuario_ativo_por_email(db, payload.email)
    credential_id = payload.credential.get("id")

    resultado = await db.execute(
        select(UsuarioPasskeyDB).where(
            UsuarioPasskeyDB.usuario_id == usuario.id,
            UsuarioPasskeyDB.credential_id == credential_id,
            UsuarioPasskeyDB.ativo == True,  # noqa: E712
        )
    )
    passkey = resultado.scalar_one_or_none()

    if not passkey:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso biométrico não reconhecido.",
        )

    try:
        verificacao = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=base64url_decode(token_payload["challenge"]),
            expected_rp_id=token_payload["rp_id"],
            expected_origin=token_payload["origin"],
            credential_public_key=base64url_decode(passkey.public_key),
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
    except Exception as erro:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar a biometria deste aparelho.",
        ) from erro

    passkey.sign_count = verificacao.new_sign_count
    passkey.ultimo_uso_em = agora_utc_sem_timezone()
    usuario.ultimo_login_em = agora_utc_sem_timezone()
    await db.commit()
    await db.refresh(usuario)

    projeto = await buscar_projeto_usuario(db, usuario)
    token = criar_access_token(
        data=montar_payload_token(usuario, projeto),
        expires_delta=timedelta(hours=12),
    )

    registrar_evento_auditoria(
        "passkey_login_sucesso",
        usuario_id=usuario.id,
        instituicao_id=usuario.instituicao_id,
        organizacao_id=getattr(usuario, "organizacao_id", None),
        perfil_acesso=getattr(usuario, "perfil_acesso", None),
        ip=obter_ip_cliente(request),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            **montar_payload_token(usuario, projeto),
            "avatar_url": getattr(usuario, "avatar_url", None),
        },
    }


@router.delete("/{passkey_id}")
async def revogar_passkey(
    passkey_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    resultado = await db.execute(
        select(UsuarioPasskeyDB).where(
            UsuarioPasskeyDB.id == passkey_id,
            UsuarioPasskeyDB.usuario_id == usuario_atual["id"],
            UsuarioPasskeyDB.ativo == True,  # noqa: E712
        )
    )
    passkey = resultado.scalar_one_or_none()

    if not passkey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acesso biométrico não encontrado.",
        )

    passkey.ativo = False
    passkey.revogado_em = agora_utc_sem_timezone()
    await db.commit()

    registrar_evento_auditoria(
        "passkey_revogada",
        usuario_id=usuario_atual["id"],
        instituicao_id=usuario_atual["instituicao_id"],
        organizacao_id=usuario_atual.get("organizacao_id"),
        ip=obter_ip_cliente(request),
    )

    return {"message": "Acesso biométrico removido deste aparelho."}
