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
from models import CobrancaCicloDB, CobrancaLiberacaoTemporariaDB, InstituicaoDB
from security import SECRET_KEY, ALGORITHM


ROTAS_LIVRES = (
    "/",
    "/api/login",
    "/api/onboarding",
    "/api/cobrancas",
    "/api/suporte",
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


def _payload_usuario_manutencao(payload: dict) -> bool:
    perfil = (payload.get("perfil_acesso") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    email_manutencao = os.getenv(
        "CARECORE_MANUTENCAO_EMAIL",
        "manutencao@carecoreplus.com.br",
    ).strip().lower()

    return bool(payload.get("is_manutencao")) or perfil == "Manutenção" or email == email_manutencao


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


def _cobranca_esta_bloqueada(
    ciclos: list[CobrancaCicloDB],
    dias_tolerancia: int,
    hoje: date | None = None,
) -> tuple[bool, str]:
    referencia = hoje or date.today()
    tolerancia = dias_tolerancia if dias_tolerancia >= 0 else 0

    for ciclo in sorted(ciclos, key=lambda item: item.data_vencimento or date.max):
        status_pagamento = (getattr(ciclo, "status_pagamento", "") or "").strip()
        vencimento = getattr(ciclo, "data_vencimento", None)

        if status_pagamento == "Vencido":
            vencimento_txt = vencimento.strftime("%d/%m/%Y") if vencimento else "não informado"
            return True, f"Fatura vencida em {vencimento_txt}."

        if status_pagamento != "Pendente" or not vencimento:
            continue

        limite = vencimento + timedelta(days=tolerancia)
        if referencia > limite:
            return True, (
                f"Fatura pendente vencida em {vencimento.strftime('%d/%m/%Y')} "
                f"e tolerância de {tolerancia} dia(s) expirada."
            )

    return False, "Cobranças sem pendência bloqueante."


def _liberacao_temporaria_ativa(
    liberacao: CobrancaLiberacaoTemporariaDB | None,
    agora: datetime | None = None,
) -> tuple[bool, str]:
    if not liberacao:
        return False, ""

    referencia = agora or datetime.utcnow()
    if not getattr(liberacao, "ativo", False):
        return False, ""

    liberado_ate = getattr(liberacao, "liberado_ate", None)
    if not liberado_ate or liberado_ate <= referencia:
        return False, ""

    return True, f"Liberação temporária ativa até {liberado_ate.strftime('%d/%m/%Y %H:%M')}."


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

    if _payload_usuario_manutencao(payload):
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

        if not bloqueada and getattr(instituicao, "organizacao_id", None):
            liberacao = (
                await db.execute(
                    select(CobrancaLiberacaoTemporariaDB)
                    .where(
                        CobrancaLiberacaoTemporariaDB.organizacao_id == instituicao.organizacao_id,
                        CobrancaLiberacaoTemporariaDB.ativo == True,  # noqa: E712
                        CobrancaLiberacaoTemporariaDB.liberado_ate > datetime.utcnow(),
                    )
                    .order_by(CobrancaLiberacaoTemporariaDB.liberado_ate.desc())
                )
            ).scalars().first()
            liberada_temporariamente, motivo_liberacao = _liberacao_temporaria_ativa(liberacao)

            ciclos_em_aberto = (
                await db.execute(
                    select(CobrancaCicloDB).where(
                        CobrancaCicloDB.organizacao_id == instituicao.organizacao_id,
                        CobrancaCicloDB.status_pagamento.in_(["Pendente", "Vencido"]),
                    )
                )
            ).scalars().all()
            bloqueada, motivo_cobranca = _cobranca_esta_bloqueada(
                list(ciclos_em_aberto),
                getattr(instituicao, "dias_tolerancia", 5) or 5,
            )
            if bloqueada:
                motivo = motivo_cobranca
            if bloqueada and liberada_temporariamente:
                bloqueada = False
                motivo = motivo_liberacao

    if bloqueada and bloqueio_ativo:
        return JSONResponse(
            status_code=402,
            content={
                "detail": "Sistema bloqueado por pendência de assinatura.",
                "motivo": motivo,
                "codigo": "LICENCA_BLOQUEADA",
                "rotas_liberadas": ["/cobrancas", "/suporte"],
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