import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.conviventes import (
    normalizar_id_tecnico_ocorrencia,
    status_inicial_ocorrencia_manual,
    tecnico_responsavel_ocorrencia_convivente,
    validar_tecnico_responsavel_ocorrencia,
)


class _ResultadoFake:
    def __init__(self, valor):
        self.valor = valor

    def scalar_one_or_none(self):
        return self.valor


class _DbFake:
    def __init__(self, valor):
        self.valor = valor

    async def execute(self, query):
        return _ResultadoFake(self.valor)


def test_ocorrencia_de_convivente_sem_tecnico_pode_ficar_sem_responsavel():
    convivente = SimpleNamespace(tecnico_id=None)

    assert tecnico_responsavel_ocorrencia_convivente(convivente, None) is None
    assert tecnico_responsavel_ocorrencia_convivente(convivente, "") is None


def test_ocorrencia_usa_tecnico_vinculado_ao_convivente():
    convivente = SimpleNamespace(tecnico_id="tecnico-1")

    assert tecnico_responsavel_ocorrencia_convivente(convivente, None) == "tecnico-1"
    assert tecnico_responsavel_ocorrencia_convivente(convivente, "tecnico-1") == "tecnico-1"


def test_ocorrencia_nao_aceita_tecnico_diferente_do_vinculado():
    convivente = SimpleNamespace(tecnico_id="tecnico-1")

    with pytest.raises(HTTPException) as erro:
        tecnico_responsavel_ocorrencia_convivente(convivente, "tecnico-2")

    assert erro.value.status_code == 400


def test_ocorrencia_manual_nasce_pendente():
    assert status_inicial_ocorrencia_manual() == "Pendente"


@pytest.mark.parametrize("valor", [None, "", " ", "null", "None", "undefined"])
def test_normaliza_tecnico_nao_definido_como_none(valor):
    assert normalizar_id_tecnico_ocorrencia(valor) is None


def test_ocorrencia_com_tecnico_vinculado_inativo_fica_sem_responsavel():
    convivente = SimpleNamespace(tecnico_id="tecnico-inativo")
    db = _DbFake(None)

    tecnico_id = asyncio.run(
        validar_tecnico_responsavel_ocorrencia(
            db,
            convivente,
            "tecnico-inativo",
            "projeto-1",
        )
    )

    assert tecnico_id is None


def test_ocorrencia_com_tecnico_vinculado_ativo_usa_responsavel():
    convivente = SimpleNamespace(tecnico_id="tecnico-ativo")
    db = _DbFake("tecnico-ativo")

    tecnico_id = asyncio.run(
        validar_tecnico_responsavel_ocorrencia(
            db,
            convivente,
            "tecnico-ativo",
            "projeto-1",
        )
    )

    assert tecnico_id == "tecnico-ativo"
