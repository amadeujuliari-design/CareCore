from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.conviventes import status_inicial_ocorrencia_manual, tecnico_responsavel_ocorrencia_convivente


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
