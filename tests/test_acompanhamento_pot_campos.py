"""Validação dos campos POT alinhados à planilha operacional."""

from datetime import date

import pytest
from pydantic import ValidationError

from schemas import AcompanhamentoPotCreate, AcompanhamentoPotUpdate, LOCAIS_POT


def test_locais_pot_opcoes_oficiais():
    assert LOCAIS_POT == [
        "POT I",
        "POT II",
        "POT Glicério",
        "Reviravolta",
        "Trabalho Formal",
        "Trabalho Informal",
    ]


def test_criar_pot_aceita_campos_planilha():
    payload = AcompanhamentoPotCreate(
        convivente_id="conv-1",
        data_insercao=date(2025, 11, 1),
        atividade="Construção civil",
        local="POT II",
        indicacao="Encaminhamento CRAS",
        observacoes="Transferência Prates",
    )
    assert payload.local == "POT II"
    assert payload.atividade == "Construção civil"
    assert payload.indicacao == "Encaminhamento CRAS"


def test_criar_pot_rejeita_local_invalido():
    with pytest.raises(ValidationError):
        AcompanhamentoPotCreate(
            convivente_id="conv-1",
            local="ARICANDUVA",
        )


def test_atualizar_pot_local_vazio_vira_none():
    payload = AcompanhamentoPotUpdate(local="  ")
    assert payload.local is None
