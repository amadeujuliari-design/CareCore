# -*- coding: utf-8 -*-

import pytest

from compras_fornecedor_contato_utils import desmembrar_contato_livre, formatar_endereco_fornecedor


def test_endereco_av():
    r = desmembrar_contato_livre("AV TIRADENTES , 282 - LUZ")
    assert r.endereco.logradouro == "AV TIRADENTES"
    assert r.endereco.numero == "282"
    assert r.endereco.bairro == "LUZ"
    assert r.representante is None


def test_cnpj_no_contato():
    r = desmembrar_contato_livre("35.953.805/0001-34")
    assert r.cnpj == "35953805000134"
    assert r.representante is None


def test_email_no_contato():
    r = desmembrar_contato_livre("pedidos@jbfrutaselegumes.com")
    assert r.email == "pedidos@jbfrutaselegumes.com"


def test_representante_simples():
    r = desmembrar_contato_livre("WILIANS")
    assert r.representante == "WILIANS"


def test_formatar_endereco():
    txt = formatar_endereco_fornecedor({
        "logradouro": "Av Tiradentes",
        "numero": "282",
        "bairro": "Luz",
        "cidade": "São Paulo",
        "uf": "SP",
        "cep": "01102000",
    })
    assert "Av Tiradentes" in txt
    assert "Luz" in txt
