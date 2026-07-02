from datetime import datetime

import pytest
from fastapi import HTTPException

from rotina_portaria_horarios import (
    UltimoMovimentoPortaria,
    validar_horario_portaria,
)


class ConviventeFake:
    def __init__(self, **kwargs):
        for chave, valor in kwargs.items():
            setattr(self, chave, valor)


def test_entrada_apos_pernoite_fora_exige_justificativa_antes_das_11():
    ultimo = UltimoMovimentoPortaria("Saída", datetime(2026, 6, 27, 18, 0))
    momento = datetime(2026, 6, 28, 10, 30)
    with pytest.raises(HTTPException) as exc:
        validar_horario_portaria(
            tipo_registro="Entrada",
            momento=momento,
            convivente=ConviventeFake(),
            ultimo_movimento=ultimo,
        )
    assert "justificativa" in exc.value.detail.lower()


def test_entrada_apos_pernoite_fora_permite_com_justificativa_antes_das_11():
    ultimo = UltimoMovimentoPortaria("Saída", datetime(2026, 6, 27, 18, 0))
    momento = datetime(2026, 6, 28, 10, 30)
    justificativa = "Retorno excepcional autorizado pela coordenação assistencial."
    resultado = validar_horario_portaria(
        tipo_registro="Entrada",
        momento=momento,
        convivente=ConviventeFake(),
        ultimo_movimento=ultimo,
        justificativa_horario=justificativa,
    )
    assert resultado == justificativa


def test_entrada_apos_pernoite_fora_permite_as_11():
    ultimo = UltimoMovimentoPortaria("Saída", datetime(2026, 6, 27, 18, 0))
    momento = datetime(2026, 6, 28, 11, 0)
    validar_horario_portaria(
        tipo_registro="Entrada",
        momento=momento,
        convivente=ConviventeFake(),
        ultimo_movimento=ultimo,
    )


def test_saida_antes_das_4_exige_justificativa_quem_pernoitou_dentro():
    ultimo = UltimoMovimentoPortaria("Entrada", datetime(2026, 6, 27, 20, 0))
    momento = datetime(2026, 6, 28, 3, 30)
    with pytest.raises(HTTPException) as exc:
        validar_horario_portaria(
            tipo_registro="Saída",
            momento=momento,
            convivente=ConviventeFake(),
            ultimo_movimento=ultimo,
        )
    assert "justificativa" in exc.value.detail.lower()


def test_saida_apos_17_exige_justificativa():
    momento = datetime(2026, 6, 28, 17, 30)
    with pytest.raises(HTTPException) as exc:
        validar_horario_portaria(
            tipo_registro="Saída",
            momento=momento,
            convivente=ConviventeFake(),
            ultimo_movimento=UltimoMovimentoPortaria("Entrada", datetime(2026, 6, 28, 8, 0)),
        )
    assert "justificativa" in exc.value.detail.lower()

    justificativa = "A" * 30
    resultado = validar_horario_portaria(
        tipo_registro="Saída",
        momento=momento,
        convivente=ConviventeFake(),
        ultimo_movimento=UltimoMovimentoPortaria("Entrada", datetime(2026, 6, 28, 8, 0)),
        justificativa_horario=justificativa,
    )
    assert resultado == justificativa


def test_excecao_cadastro_altera_limite_entrada():
    momento = datetime(2026, 6, 28, 20, 30)
    convivente = ConviventeFake(
        portaria_excecao_motivo="estudante",
        portaria_excecao_saida_ate="18:00",
        portaria_excecao_entrada_ate="22:00",
    )
    validar_horario_portaria(
        tipo_registro="Entrada",
        momento=momento,
        convivente=convivente,
        ultimo_movimento=UltimoMovimentoPortaria("Saída", datetime(2026, 6, 27, 17, 0)),
        justificativa_horario="Retorno após aula noturna na faculdade.",
    )
