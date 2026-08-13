# =====================================================================
# ARQUIVO: security.py
# CARECORE+ OFICIAL
# FASE 1B — Segurança centralizada, JWT dict-based e RBAC real
# =====================================================================
#
# NOTA TÉCNICA IMPORTANTE
# ---------------------------------------------------------------------
# Este arquivo NÃO usa mais passlib para bcrypt.
#
# Motivo:
# Em ambientes recentes com Python 3.14 + bcrypt novo, o passlib 1.7.4
# pode quebrar internamente durante a detecção do backend bcrypt com:
#
#   AttributeError: module 'bcrypt' has no attribute '__about__'
#   ValueError: password cannot be longer than 72 bytes
#
# Mesmo quando a senha digitada pelo usuário é curta e correta.
#
# Para evitar esse erro falso e estabilizar o CARECORE+, usamos bcrypt
# diretamente. Isso mantém compatibilidade com hashes existentes no formato:
#
#   $2b$12$...
#
# =====================================================================

from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional
import os
import re

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import InstituicaoDB, UsuarioDB


# =====================================================================
# CONFIGURAÇÕES
# =====================================================================

SECRET_KEY = os.getenv("SECRET_KEY", "CARECORE_SECRET_DEV_LOCAL")
ALGORITHM = "HS256"

_APP_ENV = os.getenv("APP_ENV", "local").strip().lower()
_CHAVES_SECRETAS_INACEITAVEIS_EM_PROD = {
    "CARECORE_SECRET_DEV_LOCAL",
    "carecore_local_dev",
}

if _APP_ENV in ("production", "prod") and SECRET_KEY in _CHAVES_SECRETAS_INACEITAVEIS_EM_PROD:
    raise RuntimeError(
        "APP_ENV indica produção: defina SECRET_KEY forte no .env "
        "(não use CARECORE_SECRET_DEV_LOCAL nem carecore_local_dev)."
    )
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

bearer_scheme = HTTPBearer(auto_error=True)


# =====================================================================
# PERFIS / RBAC
# =====================================================================

PERFIL_GESTOR = "Gestor"
PERFIL_GLOBAL = "Global"
PERFIL_ADM_GLOBAL = "ADM Global"
PERFIL_ADM_PRODUCAO = "ADM Produção"
PERFIL_MANUTENCAO = "Manutenção"
PERFIL_TECNICO = "Técnico"
PERFIL_ORIENTADOR = "Orientador"
PERFIL_ADMINISTRATIVO = "Administrativo"
PERFIL_CONSULTA = "Consulta"
PERFIL_OFICINEIRO = "Oficineiro(a)"

PERFIS_ACESSO_VALIDOS = {
    PERFIL_GESTOR,
    PERFIL_GLOBAL,
    PERFIL_ADM_GLOBAL,
    PERFIL_ADM_PRODUCAO,
    PERFIL_MANUTENCAO,
    PERFIL_TECNICO,
    PERFIL_ORIENTADOR,
    PERFIL_ADMINISTRATIVO,
    PERFIL_CONSULTA,
    PERFIL_OFICINEIRO,
}

# ADM Produção aparece na lista do projeto quando instituicao_id/vinculo casam.
PERFIS_EXCLUIDOS_LISTA_PROJETO = {
    PERFIL_MANUTENCAO,
    PERFIL_ADM_GLOBAL,
}

PERFIS_ADM_NFP_ORG = {
    PERFIL_ADM_GLOBAL,
    PERFIL_ADM_PRODUCAO,
}

PERFIS_LEGADOS_MAPEAMENTO = {
    "Gestao": PERFIL_GESTOR,
    "Gestão": PERFIL_GESTOR,
    "Gerente": PERFIL_GESTOR,
    "Tecnico": PERFIL_TECNICO,
    "Manutencao": PERFIL_MANUTENCAO,
    "Manutenção": PERFIL_MANUTENCAO,
    "Oficineiro": PERFIL_OFICINEIRO,
    "Adm Global": PERFIL_ADM_GLOBAL,
    "ADMGlobal": PERFIL_ADM_GLOBAL,
    "Adm Producao": PERFIL_ADM_PRODUCAO,
    "Adm Produção": PERFIL_ADM_PRODUCAO,
    "ADMProducao": PERFIL_ADM_PRODUCAO,
    "ADM Produção": PERFIL_ADM_PRODUCAO,
}

PREFIXOS_API_PERMITIDOS_OFICINEIRO = (
    "/api/atividades",
    "/api/auth",
    "/api/login",
    "/api/onboarding",
    "/api/usuarios/me",
    "/api/passkeys",
    "/api/health",
)

PREFIXOS_API_PERMITIDOS_ADM_GLOBAL = (
    "/api/nfp",
    "/api/auth",
    "/api/login",
    "/api/onboarding",
    "/api/usuarios/me",
    "/api/usuarios/organizacao",
    "/api/passkeys",
    "/api/health",
)

# ADM Produção: só leitura de cupons (+ auxiliares minimos).
PREFIXOS_API_BASE_ADM_PRODUCAO = (
    "/api/auth",
    "/api/login",
    "/api/onboarding",
    "/api/usuarios/me",
    "/api/passkeys",
    "/api/health",
)


# =====================================================================
# UTILITÁRIOS
# =====================================================================

def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalizar_perfil_acesso(perfil: Optional[str]) -> str:
    if perfil is None:
        return PERFIL_CONSULTA

    perfil_normalizado = perfil.strip()

    if not perfil_normalizado:
        return PERFIL_CONSULTA

    perfil_normalizado = PERFIS_LEGADOS_MAPEAMENTO.get(
        perfil_normalizado,
        perfil_normalizado,
    )

    return perfil_normalizado


def obter_usuario_id_de_dict(usuario: dict) -> Optional[str]:
    return (
        usuario.get("id")
        or usuario.get("sub")
        or usuario.get("usuario_id")
    )


def email_usuario_manutencao() -> str:
    return os.getenv(
        "CARECORE_MANUTENCAO_EMAIL",
        "manutencao@carecoreplus.com.br",
    ).strip().lower()


def usuario_eh_manutencao(usuario: dict | UsuarioDB | None) -> bool:
    if not usuario:
        return False

    if isinstance(usuario, dict):
        email = (usuario.get("email") or "").strip().lower()
        perfil = normalizar_perfil_acesso(usuario.get("perfil_acesso"))
        return bool(usuario.get("is_manutencao")) or perfil == PERFIL_MANUTENCAO or email == email_usuario_manutencao()

    email = (getattr(usuario, "email", None) or "").strip().lower()
    perfil = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))
    return perfil == PERFIL_MANUTENCAO or email == email_usuario_manutencao()


def usuario_eh_adm_global(usuario: dict | UsuarioDB | None) -> bool:
    if not usuario:
        return False
    if usuario_eh_manutencao(usuario):
        return False
    if isinstance(usuario, dict):
        perfil = normalizar_perfil_acesso(usuario.get("perfil_acesso"))
    else:
        perfil = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))
    return perfil == PERFIL_ADM_GLOBAL


def usuario_eh_adm_producao(usuario: dict | UsuarioDB | None) -> bool:
    if not usuario:
        return False
    if usuario_eh_manutencao(usuario):
        return False
    if isinstance(usuario, dict):
        perfil = normalizar_perfil_acesso(usuario.get("perfil_acesso"))
    else:
        perfil = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))
    return perfil == PERFIL_ADM_PRODUCAO


def usuario_eh_adm_nfp_org(usuario: dict | UsuarioDB | None) -> bool:
    return usuario_eh_adm_global(usuario) or usuario_eh_adm_producao(usuario)


def usuario_pode_acessar_nfp(usuario: dict | UsuarioDB | None) -> bool:
    if not usuario:
        return False
    if usuario_eh_manutencao(usuario) or usuario_eh_adm_nfp_org(usuario):
        return True
    if isinstance(usuario, dict):
        return bool(
            usuario.get("is_global")
            or usuario_tem_perfil(usuario, {PERFIL_GLOBAL})
        )
    perfil = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))
    return perfil == PERFIL_GLOBAL or bool(getattr(usuario, "is_global", False))


def usuario_pode_gestao_nfp_completa(usuario: dict | UsuarioDB | None) -> bool:
    """Dashboard, cadastros, relatorios e envio NFP — nao inclui ADM Producao."""
    if not usuario:
        return False
    if usuario_eh_manutencao(usuario) or usuario_eh_adm_global(usuario):
        return True
    if isinstance(usuario, dict):
        return bool(
            usuario.get("is_global")
            or usuario_tem_perfil(usuario, {PERFIL_GLOBAL})
        )
    perfil = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))
    return perfil == PERFIL_GLOBAL or bool(getattr(usuario, "is_global", False))


def usuario_pode_ver_envio_sefaz(usuario: dict | UsuarioDB | None) -> bool:
    """Tela Envio SEFAZ: Global (consulta), ADM Global e Manutencao."""
    return usuario_pode_gestao_nfp_completa(usuario)


def usuario_pode_operar_envio_sefaz(usuario: dict | UsuarioDB | None) -> bool:
    """Abrir Chrome / rodar fila: so ADM Global e Manutencao (Global so ve)."""
    if not usuario:
        return False
    return usuario_eh_manutencao(usuario) or usuario_eh_adm_global(usuario)


def usuario_pode_leitura_cupons_nfp(usuario: dict | UsuarioDB | None) -> bool:
    return usuario_pode_acessar_nfp(usuario)


def perfil_excluido_lista_projeto(perfil: Optional[str]) -> bool:
    return normalizar_perfil_acesso(perfil) in PERFIS_EXCLUIDOS_LISTA_PROJETO


# =====================================================================
# SENHA FORTE
# =====================================================================

def validar_senha_forte(senha: str) -> None:
    if not senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha obrigatória.",
        )

    if len(senha) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir no mínimo 8 caracteres.",
        )

    # Limite técnico real do bcrypt.
    # Validado antes do hash para nunca gerar erro 500.
    if len(senha.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha não pode ultrapassar 72 bytes.",
        )

    if not re.search(r"[A-Z]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir ao menos 1 letra maiúscula.",
        )

    if not re.search(r"[a-z]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir ao menos 1 letra minúscula.",
        )

    if not re.search(r"\d", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir ao menos 1 número.",
        )

    if not re.search(r"[@$!%*?&_\-#]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir ao menos 1 caractere especial.",
        )


# =====================================================================
# HASH / VERIFICAÇÃO DE SENHA
# =====================================================================

def gerar_hash_senha(senha: str) -> str:
    validar_senha_forte(senha)

    try:
        senha_bytes = senha.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(senha_bytes, salt).decode("utf-8")

    except ValueError as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Senha inválida: {str(erro)}",
        )

    except Exception as erro:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao gerar hash de senha: {str(erro)}",
        )


def verificar_senha(senha_plain: str, senha_hash: str) -> bool:
    if not senha_plain or not senha_hash:
        return False

    try:
        if len(senha_plain.encode("utf-8")) > 72:
            return False

        return bcrypt.checkpw(
            senha_plain.encode("utf-8"),
            senha_hash.encode("utf-8"),
        )

    except Exception:
        return False


# Compatibilidade com nomes legados usados em arquivos auxiliares.
def hash_senha(senha: str) -> str:
    return gerar_hash_senha(senha)


def get_password_hash(senha: str) -> str:
    return gerar_hash_senha(senha)


def verify_password(senha_plain: str, senha_hash: str) -> bool:
    return verificar_senha(senha_plain, senha_hash)


# Objeto mínimo de compatibilidade para scripts antigos que importam pwd_context.
class _PwdContextCompat:
    def hash(self, senha: str) -> str:
        return gerar_hash_senha(senha)

    def verify(self, senha_plain: str, senha_hash: str) -> bool:
        return verificar_senha(senha_plain, senha_hash)


pwd_context = _PwdContextCompat()


# =====================================================================
# JWT
# =====================================================================

def criar_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    payload = data.copy()

    expire = agora_utc() + (
        expires_delta
        if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload.update({"exp": expire})

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def criar_token_acesso(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    return criar_access_token(data, expires_delta)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    return criar_access_token(data, expires_delta)


def decodificar_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )


def validar_token_version(payload: dict, usuario: UsuarioDB) -> None:
    versao_token = payload.get("token_version")
    if versao_token is None:
        return

    try:
        versao_token_int = int(versao_token)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida. Faça login novamente.",
        )

    versao_usuario = int(getattr(usuario, "token_version", 0) or 0)
    if versao_token_int != versao_usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )


# =====================================================================
# USUÁRIO LOGADO
# IMPORTANTE:
# Esta função retorna DICT, não ORM.
#
# O CARECORE+ oficial depende estruturalmente de:
# usuario_atual["instituicao_id"]
# usuario_atual["sub"]
# usuario_atual["perfil_acesso"]
#
# Não alterar para objeto ORM.
# =====================================================================

async def get_usuario_logado(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    token = credentials.credentials
    payload = decodificar_token(token)

    usuario_id = payload.get("sub") or payload.get("id")

    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    resultado = await db.execute(
        select(UsuarioDB).where(UsuarioDB.id == usuario_id)
    )

    usuario = resultado.scalar_one_or_none()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )

    if not bool(getattr(usuario, "ativo", True)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Acesso bloqueado.",
        )

    validar_token_version(payload, usuario)

    perfil_acesso = normalizar_perfil_acesso(
        getattr(usuario, "perfil_acesso", None)
    )
    instituicao_id = usuario.instituicao_id
    organizacao_id = getattr(usuario, "organizacao_id", None)

    if usuario_eh_manutencao(usuario):
        instituicao_token = payload.get("instituicao_id")
        if instituicao_token:
            resultado_projeto = await db.execute(
                select(InstituicaoDB).where(InstituicaoDB.id == instituicao_token)
            )
            projeto_token = resultado_projeto.scalar_one_or_none()
            if projeto_token:
                instituicao_id = projeto_token.id
                organizacao_id = getattr(projeto_token, "organizacao_id", organizacao_id)

    elif bool(getattr(usuario, "is_global", False)):
        instituicao_token = payload.get("instituicao_id")
        if instituicao_token:
            resultado_projeto = await db.execute(
                select(InstituicaoDB).where(
                    InstituicaoDB.id == instituicao_token,
                    InstituicaoDB.organizacao_id == organizacao_id,
                )
            )
            projeto_token = resultado_projeto.scalar_one_or_none()
            if projeto_token:
                instituicao_id = projeto_token.id

    return {
        "id": usuario.id,
        "sub": usuario.id,
        "usuario_id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "instituicao_id": instituicao_id,
        "organizacao_id": organizacao_id,
        "perfil_acesso": perfil_acesso,
        "is_master": bool(getattr(usuario, "is_master", False)),
        "is_global": bool(getattr(usuario, "is_global", False)),
        "is_manutencao": usuario_eh_manutencao(usuario),
        "ativo": bool(getattr(usuario, "ativo", True)),
        "token_version": int(getattr(usuario, "token_version", 0) or 0),
        "nfp_captador_vinculo": getattr(usuario, "nfp_captador_vinculo", None),
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_usuario_logado(credentials, db)


async def get_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_usuario_logado(credentials, db)


# =====================================================================
# RBAC
# =====================================================================

def usuario_tem_perfil(
    usuario: dict,
    perfis_permitidos: Iterable[str],
) -> bool:
    perfil_usuario = normalizar_perfil_acesso(
        usuario.get("perfil_acesso")
    )

    perfis_normalizados = {
        normalizar_perfil_acesso(perfil)
        for perfil in perfis_permitidos
    }

    return perfil_usuario in perfis_normalizados


def usuario_eh_gestor(usuario: dict) -> bool:
    return bool(
        usuario.get("is_master")
        or usuario_tem_perfil(usuario, {PERFIL_GESTOR})
    )


# Allowlist operacional SIAT: cadastro/edição/exclusão de atividades.
EMAILS_CADASTRO_ATIVIDADES_SIAT = frozenset(
    {
        "luciana@carecore.com",
    }
)


def email_usuario_normalizado(usuario: dict | None) -> str:
    if not usuario:
        return ""
    return str(usuario.get("email") or "").strip().lower()


def usuario_na_allowlist_cadastro_atividades_siat(usuario: dict | None) -> bool:
    email = email_usuario_normalizado(usuario)
    return bool(email) and email in EMAILS_CADASTRO_ATIVIDADES_SIAT


def usuario_pode_gerenciar_cadastro_atividades_siat(usuario: dict | None) -> bool:
    """No SIAT: Gestor, Luciana (allowlist) e Manutenção."""
    if not usuario:
        return False
    if usuario_eh_manutencao(usuario):
        return True
    if usuario_eh_gestor(usuario):
        return True
    return usuario_na_allowlist_cadastro_atividades_siat(usuario)


def usuario_pode_ver_texto_original(usuario: dict) -> bool:
    """Somente Gestor e Manutenção veem o texto original antes da revisão por IA."""
    return usuario_eh_gestor(usuario) or usuario_eh_manutencao(usuario)


def usuario_eh_global_puro(usuario: dict) -> bool:
    if usuario_eh_manutencao(usuario) or usuario_eh_adm_nfp_org(usuario):
        return False

    return bool(
        (
            usuario.get("is_global")
            or usuario_tem_perfil(usuario, {PERFIL_GLOBAL})
        )
        and not usuario_eh_gestor(usuario)
    )


def usuario_eh_suporte_manutencao(usuario: dict) -> bool:
    return usuario_eh_manutencao(usuario)


MSG_GLOBAL_SOMENTE_CONSULTA = (
    "Usuários Globais apenas consultam e imprimem relatórios gerenciais. "
    "Não é permitido editar dados nem realizar ações operacionais."
)


def bloquear_usuario_global_puro(usuario: dict) -> None:
    if usuario_eh_global_puro(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MSG_GLOBAL_SOMENTE_CONSULTA,
        )


def usuario_eh_oficineiro(usuario: dict | None) -> bool:
    if not usuario or usuario_eh_manutencao(usuario):
        return False
    return usuario_tem_perfil(usuario, {PERFIL_OFICINEIRO})


def caminho_api_permitido_para_oficineiro(path: str, method: str = "GET") -> bool:
    for prefixo in PREFIXOS_API_PERMITIDOS_OFICINEIRO:
        if path == prefixo or path.startswith(prefixo + "/"):
            return True

    if method.upper() == "GET" and path == "/api/usuarios":
        return True

    return False


def caminho_api_permitido_para_adm_global(path: str, method: str = "GET") -> bool:
    del method  # reservado para regras futuras por metodo
    for prefixo in PREFIXOS_API_PERMITIDOS_ADM_GLOBAL:
        if path == prefixo or path.startswith(prefixo + "/"):
            return True
    return False


def caminho_api_permitido_para_adm_producao(path: str, method: str = "GET") -> bool:
    metodo = (method or "GET").upper()
    for prefixo in PREFIXOS_API_BASE_ADM_PRODUCAO:
        if path == prefixo or path.startswith(prefixo + "/"):
            return True

    if path == "/api/nfp/me/acesso" and metodo == "GET":
        return True
    if path.startswith("/api/nfp/cupons"):
        if metodo == "GET":
            return True
        if path.rstrip("/").endswith("/leitura") and metodo == "POST":
            return True
        return False
    if path == "/api/nfp/agentes" and metodo == "GET":
        return True
    if path == "/api/nfp/agentes/garantir-padrao" and metodo == "POST":
        return True
    return False


def extrair_payload_autorizacao_bearer(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None

    token = authorization[7:].strip()
    if not token:
        return None

    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def usuario_eh_tecnico_ou_superior(usuario: dict) -> bool:
    return bool(
        usuario_eh_gestor(usuario)
        or usuario_eh_manutencao(usuario)
        or usuario_tem_perfil(
            usuario,
            {
                PERFIL_TECNICO,
                PERFIL_ADMINISTRATIVO,
            },
        )
    )


def usuario_pode_consultar(usuario: dict) -> bool:
    return usuario_tem_perfil(
        usuario,
        {
            PERFIL_GESTOR,
            PERFIL_TECNICO,
            PERFIL_ORIENTADOR,
            PERFIL_ADMINISTRATIVO,
            PERFIL_CONSULTA,
        },
    ) or bool(usuario.get("is_master"))


async def exigir_gestor(
    usuario: dict = Depends(get_usuario_logado),
) -> dict:
    if not usuario_eh_gestor(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao perfil Gestor.",
        )

    return usuario


async def exigir_tecnico_ou_gestor(
    usuario: dict = Depends(get_usuario_logado),
) -> dict:
    if not usuario_eh_tecnico_ou_superior(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a Gestor, Técnico ou Administrativo.",
        )

    return usuario


async def exigir_usuario_ativo(
    usuario: dict = Depends(get_usuario_logado),
) -> dict:
    if not bool(usuario.get("ativo", True)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Acesso bloqueado.",
        )

    return usuario


def exigir_perfis(*perfis: str):
    async def dependencia(
        usuario: dict = Depends(get_usuario_logado),
    ) -> dict:
        if usuario.get("is_master") or usuario_eh_manutencao(usuario):
            return usuario

        if not usuario_tem_perfil(usuario, perfis):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não possui permissão para acessar este recurso.",
            )

        return usuario

    return dependencia
