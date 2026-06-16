from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ASAAS_URLS = {
    "sandbox": "https://api-sandbox.asaas.com/v3",
    "production": "https://api.asaas.com/v3",
}

ASAAS_PREFIXOS = {
    "sandbox": "$aact_hmlg_",
    "production": "$aact_prod_",
}


def carregar_env_local_asaas() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for linha in env_path.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue

        chave, valor = linha.split("=", 1)
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")
        if os.environ.get(chave) in {None, ""}:
            os.environ[chave] = valor


class AsaasConfigErro(RuntimeError):
    pass


class AsaasErro(RuntimeError):
    def __init__(self, status_code: int | None, mensagem: str, resposta: Any = None):
        super().__init__(mensagem)
        self.status_code = status_code
        self.resposta = resposta


@dataclass(frozen=True)
class AsaasConfig:
    ambiente: str
    base_url: str
    api_key: str

    @property
    def configurado(self) -> bool:
        return bool(self.api_key)

    @property
    def api_key_mascarada(self) -> str | None:
        if not self.api_key:
            return None
        if len(self.api_key) <= 12:
            return "***"
        return f"{self.api_key[:12]}...{self.api_key[-4:]}"


def _normalizar_ambiente(valor: str | None) -> str:
    ambiente = (valor or "sandbox").strip().lower()
    aliases = {
        "dev": "sandbox",
        "development": "sandbox",
        "homologacao": "sandbox",
        "homologação": "sandbox",
        "hml": "sandbox",
        "hmlg": "sandbox",
        "prod": "production",
        "producao": "production",
        "produção": "production",
    }
    ambiente = aliases.get(ambiente, ambiente)
    if ambiente not in ASAAS_URLS:
        raise AsaasConfigErro("ASAAS_ENV deve ser 'sandbox' ou 'production'.")
    return ambiente


def obter_config_asaas(env: Callable[[str, str | None], str | None] | None = None) -> AsaasConfig:
    if env is None:
        carregar_env_local_asaas()

    env_get = env or os.getenv
    ambiente = _normalizar_ambiente(env_get("ASAAS_ENV", "sandbox"))

    chave_especifica = (
        "ASAAS_API_KEY_SANDBOX"
        if ambiente == "sandbox"
        else "ASAAS_API_KEY_PRODUCTION"
    )
    api_key = (
        env_get("ASAAS_API_KEY", None)
        or env_get(chave_especifica, None)
        or ""
    ).strip()

    base_url = (env_get("ASAAS_BASE_URL", None) or ASAAS_URLS[ambiente]).strip().rstrip("/")
    return AsaasConfig(ambiente=ambiente, base_url=base_url, api_key=api_key)


def validar_config_asaas(config: AsaasConfig) -> None:
    if not config.api_key:
        raise AsaasConfigErro("Chave da API Asaas não configurada.")

    prefixo_esperado = ASAAS_PREFIXOS[config.ambiente]
    if not config.api_key.startswith(prefixo_esperado):
        raise AsaasConfigErro(
            "Chave da API Asaas não combina com o ambiente configurado."
        )

    base_url_esperada = ASAAS_URLS[config.ambiente]
    if config.base_url != base_url_esperada and not os.getenv("ASAAS_PERMITIR_BASE_URL_CUSTOMIZADA"):
        raise AsaasConfigErro(
            "URL da API Asaas não combina com o ambiente configurado."
        )


class AsaasClient:
    def __init__(
        self,
        config: AsaasConfig | None = None,
        opener: Callable[..., Any] | None = None,
        timeout: int = 20,
    ):
        self.config = config or obter_config_asaas()
        validar_config_asaas(self.config)
        self._opener = opener or urlopen
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "CareCorePlus/1.0",
            "access_token": self.config.api_key,
        }

    def request(
        self,
        metodo: str,
        caminho: str,
        payload: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        caminho_normalizado = "/" + caminho.strip("/")
        query = f"?{urlencode(params)}" if params else ""
        url = f"{self.config.base_url}{caminho_normalizado}{query}"
        corpo = json.dumps(payload).encode("utf-8") if payload is not None else None

        requisicao = Request(
            url,
            data=corpo,
            method=metodo.upper(),
            headers=self._headers(),
        )

        try:
            with self._opener(requisicao, timeout=self.timeout) as resposta:
                conteudo = resposta.read().decode("utf-8")
                return json.loads(conteudo) if conteudo else {}
        except HTTPError as erro:
            conteudo = erro.read().decode("utf-8")
            resposta_erro = json.loads(conteudo) if conteudo else None
            mensagem = _mensagem_erro_asaas(resposta_erro) or "Erro retornado pela API Asaas."
            raise AsaasErro(erro.code, mensagem, resposta_erro) from erro
        except URLError as erro:
            raise AsaasErro(None, "Falha de comunicação com a API Asaas.") from erro

    def testar_conexao(self) -> dict[str, Any]:
        return self.request("GET", "/customers", params={"limit": 1})

    def criar_cliente(self, dados_cliente: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", "/customers", payload=dados_cliente)

    def criar_cobranca(self, dados_cobranca: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", "/payments", payload=dados_cobranca)


def _mensagem_erro_asaas(resposta: Any) -> str | None:
    if not isinstance(resposta, dict):
        return None
    erros = resposta.get("errors")
    if not isinstance(erros, list) or not erros:
        return None
    descricoes = [
        str(erro.get("description")).strip()
        for erro in erros
        if isinstance(erro, dict) and erro.get("description")
    ]
    return "; ".join(descricoes) or None
