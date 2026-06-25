"""Testes do espelhamento PIA ↔ acompanhamentos."""
from datetime import date

import pytest

from pia_acompanhamento_sync import (
    ORIGEM_DISCUSSAO,
    ORIGEM_POT,
    ORIGEM_TB,
    _descricao_texto,
    _fmt_data,
    _hospital_exibicao,
)


def test_hospital_exibicao_outros():
    assert _hospital_exibicao("Outros", "Hospital X") == "Outros — Hospital X"
    assert _hospital_exibicao("HC-FMUSP", None) == "HC-FMUSP"


def test_descricao_texto_fallback():
    assert _descricao_texto(None) == "Sem observações registradas."
    assert _descricao_texto("  anotacao  ") == "anotacao"


def test_fmt_data():
    assert _fmt_data(date(2026, 6, 23)) == "23/06/2026"
    assert _fmt_data(None) == ""


def test_origem_modulos_definidos():
    assert ORIGEM_DISCUSSAO == "discussao_hospitalar"
    assert ORIGEM_TB == "tuberculose"
    assert ORIGEM_POT == "pot"
