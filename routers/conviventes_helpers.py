from datetime import UTC, datetime, timedelta

from models import ConviventeDB, OcorrenciaConviventeDB
from schemas import ConviventeResponse
from security import (
    PERFIL_GESTOR,
    PERFIL_TECNICO,
    normalizar_perfil_acesso,
    usuario_eh_gestor,
)
from credenciais_convivente import (
    criptografar_credencial,
    descriptografar_credencial_armazenado,
)


PRIORIDADES_OCORRENCIA = ["Baixa", "Média", "Alta", "Crítica"]
PESO_PRIORIDADE = {"Baixa": 1, "Média": 2, "Alta": 3, "Crítica": 4}


def normalizar_prioridade_ocorrencia(valor: str | None) -> str:
    if not valor:
        return "Média"

    valor_limpo = str(valor).strip().lower()
    mapa = {
        "baixa": "Baixa",
        "baixo": "Baixa",
        "media": "Média",
        "média": "Média",
        "medio": "Média",
        "médio": "Média",
        "alta": "Alta",
        "alto": "Alta",
        "critica": "Crítica",
        "crítica": "Crítica",
        "critico": "Crítica",
        "crítico": "Crítica",
    }
    return mapa.get(valor_limpo, "Média")


def usuario_pode_ver_credenciais_cofre_convivente(
    usuario_atual: dict,
    conv: ConviventeDB,
) -> bool:
    perfil = normalizar_perfil_acesso(usuario_atual.get("perfil_acesso"))

    if usuario_atual.get("is_master") or perfil == PERFIL_GESTOR:
        return True

    if perfil == PERFIL_TECNICO:
        return str(usuario_atual.get("sub")) == str(getattr(conv, "tecnico_id", ""))

    return False


def aplicar_credenciais_convivente_salvar(dados: dict) -> None:
    if "senha_email" in dados:
        dados["senha_email"] = criptografar_credencial(dados.get("senha_email"))

    if "senha_govbr" in dados:
        dados["senha_govbr"] = criptografar_credencial(dados.get("senha_govbr"))


def usuario_pode_resolver_ocorrencia(
    usuario_atual: dict,
    ocorrencia: OcorrenciaConviventeDB,
) -> bool:
    if usuario_eh_gestor(usuario_atual):
        return True

    perfil = normalizar_perfil_acesso(usuario_atual.get("perfil_acesso"))

    if perfil != PERFIL_TECNICO:
        return False

    tecnico_responsavel_id = getattr(ocorrencia, "tecnico_responsavel_id", None)
    if not tecnico_responsavel_id:
        return True

    return str(usuario_atual.get("sub")) == str(tecnico_responsavel_id)


def convivente_para_response(
    conv: ConviventeDB,
    usuario_atual: dict,
) -> ConviventeResponse:
    base = ConviventeResponse.model_validate(conv)

    if usuario_pode_ver_credenciais_cofre_convivente(usuario_atual, conv):
        return base.model_copy(
            update={
                "senha_email": descriptografar_credencial_armazenado(conv.senha_email),
                "senha_govbr": descriptografar_credencial_armazenado(conv.senha_govbr),
            },
        )

    return base.model_copy(update={"senha_email": None, "senha_govbr": None})


def agora_sao_paulo():
    """
    Retorna data/hora local de São Paulo sem depender da base IANA/tzdata.
    São Paulo atualmente opera em UTC-3 sem horário de verão.
    """
    return datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3)
