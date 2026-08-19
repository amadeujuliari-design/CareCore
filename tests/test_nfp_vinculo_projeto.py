"""Testes do vinculo NFP <-> projeto CareCore."""

from nfp_vinculo_projeto import (
    aplicar_endereco_org_na_instituicao_sede,
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


def test_aplicar_endereco_org_na_sede():
    from types import SimpleNamespace

    org = SimpleNamespace(
        cep="01001000",
        logradouro="Rua da Organização",
        numero="100",
        complemento=None,
        bairro="Sé",
        cidade="São Paulo",
        uf="SP",
        cnpj="61705877000172",
        telefone="1126195400",
        email="aeb@example.org",
        emails_adicionais=None,
    )
    inst = SimpleNamespace(
        cep=None,
        logradouro="AVIS 1 CAIXA DE COPO",
        numero=None,
        complemento=None,
        bairro=None,
        cidade="São Paulo",
        uf="SP",
        cnpj="61705877000172",
        telefone="1126195400",
        email=None,
        emails_adicionais=None,
    )
    assert aplicar_endereco_org_na_instituicao_sede(org, inst)
    assert inst.logradouro == "Rua da Organização"
    assert inst.numero == "100"
    assert inst.cep == "01001000"


def test_captadores_compativeis_inclui_aliases():
    comps = captadores_compativeis_com_projeto("SIAT II ARMÊNIA")
    assert "SIAT II ARMENIA" in comps or "SIAT II ARMÊNIA" in comps
