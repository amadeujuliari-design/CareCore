# -*- coding: utf-8 -*-

import pytest

from compras_fornecedor_contato_utils import desmembrar_contato_livre, formatar_endereco_fornecedor, sanitizar_campos_contato_fornecedor


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


def test_sanitizar_telefone_no_email_move():
    limpo, mudancas = sanitizar_campos_contato_fornecedor({
        "email": "(11) 97301-1859",
        "telefone": None,
    })
    assert limpo["email"] is None
    assert limpo["telefone"] == "11973011859"
    assert mudancas


def test_sanitizar_telefone_no_email_ja_tem_telefone():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "email": "11 98105-7507",
        "telefone": "11981057507",
    })
    assert limpo["email"] is None
    assert limpo["telefone"] == "11981057507"


def test_sanitizar_gmail_sem_arroba():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "email": "dominicdedetizadora.sp.gmail.com",
    })
    assert limpo["email"] == "dominicdedetizadora.sp@gmail.com"


def test_sanitizar_site_vai_obs():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "email": "www.mcalimpeza.com.br",
        "observacao": None,
    })
    assert limpo["email"] is None
    assert "mcalimpeza" in (limpo["observacao"] or "").lower()


def test_sanitizar_endereco_no_email():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "email": "AV TIRADENTES , 282",
        "logradouro": None,
    })
    assert limpo["email"] is None
    assert limpo["logradouro"] == "AV TIRADENTES"
    assert limpo["numero"] == "282"


def test_sanitizar_telefone_lixo():
    limpo, mudancas = sanitizar_campos_contato_fornecedor({
        "telefone": "PEDAGOGICO/ESCRITORIO",
    })
    assert limpo["telefone"] is None
    assert any("telefone" in m for m in mudancas)


def test_sanitizar_localidade_no_email():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "email": "CARAPICUIBA",
        "contato": None,
        "bairro": None,
    })
    assert limpo["email"] is None
    assert limpo["bairro"] == "CARAPICUIBA"
    assert limpo["contato"] is None


def test_sanitizar_telefone_truncado():
    limpo, _ = sanitizar_campos_contato_fornecedor({
        "telefone": "(11) 91339-0580-3705-3799",
    })
    assert limpo["telefone"] == "11913390580"
