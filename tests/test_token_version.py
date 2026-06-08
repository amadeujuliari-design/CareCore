from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.usuarios import incrementar_token_version
from security import validar_token_version


def test_token_sem_versao_continua_compatível():
    usuario = SimpleNamespace(token_version=3)

    validar_token_version({}, usuario)


def test_token_com_mesma_versao_eh_aceito():
    usuario = SimpleNamespace(token_version=3)

    validar_token_version({"token_version": 3}, usuario)
    validar_token_version({"token_version": "3"}, usuario)


def test_token_com_versao_antiga_eh_rejeitado():
    usuario = SimpleNamespace(token_version=4)

    with pytest.raises(HTTPException) as erro:
        validar_token_version({"token_version": 3}, usuario)

    assert erro.value.status_code == 401


def test_token_com_versao_invalida_eh_rejeitado():
    usuario = SimpleNamespace(token_version=0)

    with pytest.raises(HTTPException) as erro:
        validar_token_version({"token_version": "abc"}, usuario)

    assert erro.value.status_code == 401


def test_incrementar_token_version_trata_valor_nulo():
    usuario = SimpleNamespace(token_version=None)

    incrementar_token_version(usuario)

    assert usuario.token_version == 1
