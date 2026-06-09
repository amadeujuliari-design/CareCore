# =====================================================================
# ARQUIVO: licenciamento.py
# Middleware SaaS/local para controle de licença/assinatura institucional
# =====================================================================
from datetime import date, datetime, timedelta
import os

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from database import AsyncSessionLocal
from models import InstituicaoDB
from security import SECRET_KEY, ALGORITHM


ROTAS_LIVRES = (
    "/",
    "/api/login",
    "/api/onboarding",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/uploads",
)


def _bool_env(nome: str, padrao: str = "false") -> bool:
    return os.getenv(nome, padrao).strip().lower() in {
        "1",
        "true",
        "sim",
        "yes",
        "on",
    }


def _rota_livre(path: str) -> bool:
    return any(path == rota or path.startswith(f"{rota}/") for rota in ROTAS_LIVRES)


def _extrair_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization") or request.headers.get("Authorization")

    if not authorization:
        return None

    partes = authorization.split()

    if len(partes) != 2:
        return None

    tipo, token = partes

    if tipo.lower() != "bearer":
        return None

    return token


def _licenca_esta_bloqueada(instituicao: InstituicaoDB) -> tuple[bool, str]:
    if getattr(instituicao, "bloqueado", False):
        return True, "Instituição bloqueada administrativamente."

    data_vencimento = getattr(instituicao, "data_vencimento", None)

    if not data_vencimento:
        return False, "Licença sem vencimento definido."

    if isinstance(data_vencimento, datetime):
        vencimento = data_vencimento.date()
    else:
        vencimento = data_vencimento

    dias_tolerancia = getattr(instituicao, "dias_tolerancia", 5) or 5
    limite = vencimento + timedelta(days=dias_tolerancia)

    if date.today() > limite:
        return True, (
            f"Assinatura vencida em {vencimento.strftime('%d/%m/%Y')} "
            f"e tolerância de {dias_tolerancia} dia(s) expirada."
        )

    return False, "Licença ativa dentro do prazo/tolerância."


async def middleware_licenciamento(request: Request, call_next):
    """
    Middleware de licenciamento SaaS/local.

    Importante:
    - Requisições OPTIONS precisam passar livremente para o CORS.
    - Rotas públicas de login/onboarding/docs/uploads não devem ser bloqueadas.
    """

    # Libera preflight CORS
    if request.method == "OPTIONS":
        return await call_next(request)

    if _rota_livre(request.url.path):
        return await call_next(request)

    token = _extrair_token(request)

    if not token:
        return await call_next(request)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return await call_next(request)

    instituicao_id = payload.get("instituicao_id")

    if not instituicao_id:
        return await call_next(request)

    bloqueio_ativo = _bool_env("SAAS_BLOQUEIO_ATIVO", "false")

    async with AsyncSessionLocal() as db:
        instituicao = (
            await db.execute(
                select(InstituicaoDB).where(
                    InstituicaoDB.id == instituicao_id
                )
            )
        ).scalar_one_or_none()

        if not instituicao:
            return await call_next(request)

        bloqueada, motivo = _licenca_esta_bloqueada(instituicao)

    if bloqueada and bloqueio_ativo:
        return JSONResponse(
            status_code=402,
            content={
                "detail": "Sistema bloqueado por pendência de assinatura.",
                "motivo": motivo,
                "codigo": "LICENCA_BLOQUEADA",
            },
        )

    response = await call_next(request)

    response.headers["X-CareCore-Licenca-Status"] = (
        "bloqueada" if bloqueada else "ativa"
    )
    response.headers["X-CareCore-Licenca-Motivo"] = motivo[:180]
    response.headers["X-CareCore-Bloqueio-Ativo"] = (
        "true" if bloqueio_ativo else "false"
    )

    return response