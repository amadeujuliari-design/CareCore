import pytest
from pydantic import ValidationError

from refeicao_horario_operacional import mensagem_indica_horario_refeicao_fora_janela
from rotina_portaria_horarios import (
    mensagem_indica_justificativa_horario_portaria,
    mensagem_indica_portaria_bloqueada_sem_justificativa,
)
from schemas import CarteirinhaImpressaoOficialCreate


def test_carteirinha_impressao_create_defaults():
    payload = CarteirinhaImpressaoOficialCreate()
    assert payload.quantidade == 1
    assert payload.origem == "unitaria"


def test_carteirinha_impressao_create_rejeita_origem_invalida():
    with pytest.raises(ValidationError):
        CarteirinhaImpressaoOficialCreate(origem="preview")


def test_mensagem_indica_horario_refeicao():
    mensagem = "Registro de almoço permitido apenas entre 11:50 e 14:30 (horário de Brasília)."
    assert mensagem_indica_horario_refeicao_fora_janela(mensagem) is True


def test_mensagem_indica_portaria_bloqueada_sem_justificativa():
    mensagem = "Este convivente pernoitou fora da unidade. A entrada só pode ser registrada a partir das 11:00."
    assert mensagem_indica_portaria_bloqueada_sem_justificativa(mensagem) is True
    assert mensagem_indica_justificativa_horario_portaria(mensagem) is False


def test_mensagem_portaria_com_justificativa_nao_e_bloqueio_rigido():
    mensagem = "Entrada após 19:00 exige justificativa de no mínimo 30 caracteres."
    assert mensagem_indica_justificativa_horario_portaria(mensagem) is True
    assert mensagem_indica_portaria_bloqueada_sem_justificativa(mensagem) is False
