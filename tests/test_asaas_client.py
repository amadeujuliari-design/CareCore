import json
from urllib.error import HTTPError

import pytest

from asaas_client import (
    ASAAS_URLS,
    AsaasClient,
    AsaasConfig,
    AsaasConfigErro,
    AsaasErro,
    obter_config_asaas,
)


class _RespostaFake:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def close(self):
        pass


def test_config_asaas_padrao_usa_sandbox():
    config = obter_config_asaas(lambda nome, padrao=None: padrao)

    assert config.ambiente == "sandbox"
    assert config.base_url == ASAAS_URLS["sandbox"]
    assert not config.configurado


def test_config_asaas_usa_chave_especifica_sandbox():
    variaveis = {
        "ASAAS_ENV": "sandbox",
        "ASAAS_API_KEY_SANDBOX": "$aact_hmlg_1234567890",
    }

    config = obter_config_asaas(lambda nome, padrao=None: variaveis.get(nome, padrao))

    assert config.api_key == "$aact_hmlg_1234567890"
    assert config.api_key_mascarada == "$aact_hmlg_1...7890"


def test_cliente_rejeita_chave_de_producao_no_sandbox():
    config = AsaasConfig(
        ambiente="sandbox",
        base_url=ASAAS_URLS["sandbox"],
        api_key="$aact_prod_1234567890",
    )

    with pytest.raises(AsaasConfigErro):
        AsaasClient(config=config)


def test_cliente_envia_access_token_e_user_agent():
    chamadas = []

    def opener(requisicao, timeout):
        chamadas.append((requisicao, timeout))
        return _RespostaFake({"data": []})

    config = AsaasConfig(
        ambiente="sandbox",
        base_url=ASAAS_URLS["sandbox"],
        api_key="$aact_hmlg_1234567890",
    )
    cliente = AsaasClient(config=config, opener=opener, timeout=7)

    resposta = cliente.testar_conexao()

    assert resposta == {"data": []}
    requisicao, timeout = chamadas[0]
    assert timeout == 7
    assert requisicao.full_url == "https://api-sandbox.asaas.com/v3/customers?limit=1"
    assert requisicao.headers["Access_token"] == "$aact_hmlg_1234567890"
    assert requisicao.headers["User-agent"] == "CareCorePlus/1.0"


def test_cliente_traduz_erro_asaas():
    def opener(requisicao, timeout):
        raise HTTPError(
            requisicao.full_url,
            401,
            "Unauthorized",
            hdrs=None,
            fp=_RespostaFake({
                "errors": [
                    {
                        "code": "invalid_token",
                        "description": "Chave inválida.",
                    }
                ]
            }),
        )

    config = AsaasConfig(
        ambiente="sandbox",
        base_url=ASAAS_URLS["sandbox"],
        api_key="$aact_hmlg_1234567890",
    )
    cliente = AsaasClient(config=config, opener=opener)

    with pytest.raises(AsaasErro) as erro:
        cliente.testar_conexao()

    assert erro.value.status_code == 401
    assert str(erro.value) == "Chave inválida."
