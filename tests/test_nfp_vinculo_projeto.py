"""Testes do vinculo NFP <-> projeto CareCore."""

from nfp_vinculo_projeto import (
    captadores_compativeis_com_projeto,
    rotulo_captador_de_projeto,
    vinculo_eh_sede,
    vinculo_pertence_ao_projeto,
)


def test_rotulo_captador_sede_e_siat():
    assert rotulo_captador_de_projeto("SEDE AEB") == "SEDE AEB"
    assert rotulo_captador_de_projeto("SIAT II ARMÊNIA") == "SIAT II ARMÊNIA"
    assert rotulo_captador_de_projeto("SIAT II ARMENIA") in {
        "SIAT II ARMÊNIA",
        "SIAT II ARMENIA",
    }


def test_vinculo_pertence_ao_projeto_aliases():
    assert vinculo_pertence_ao_projeto("SIAT II ARMÊNIA", "SIAT II ARMENIA")
    assert vinculo_pertence_ao_projeto("SEDE AEB", "SEDE AEB")
    assert not vinculo_pertence_ao_projeto("SEDE AEB", "SIAT II ARMÊNIA")
    assert not vinculo_pertence_ao_projeto("SIAT II ARMÊNIA", "CEI BELÉM")


def test_vinculo_eh_sede():
    assert vinculo_eh_sede("SEDE AEB")
    assert vinculo_eh_sede("SEDE")
    assert not vinculo_eh_sede("SIAT II ARMÊNIA")


def test_captadores_compativeis_inclui_aliases():
    comps = captadores_compativeis_com_projeto("SIAT II ARMÊNIA")
    assert "SIAT II ARMENIA" in comps or "SIAT II ARMÊNIA" in comps
