from nfp_utils import montar_paginacao_lista, numero_cadastro_da_busca


def test_numero_cadastro_ignora_cnpj_completo():
    assert numero_cadastro_da_busca("62401963000588") is None
    assert numero_cadastro_da_busca("62.401.963/0005-88") is None


def test_numero_cadastro_aceita_sequencial():
    assert numero_cadastro_da_busca("16") == 16
    assert numero_cadastro_da_busca("0") == 0


def test_numero_cadastro_ignora_cpf_completo():
    assert numero_cadastro_da_busca("12345678901") is None


def test_montar_paginacao_lista_diego_582():
    pag = montar_paginacao_lista(582, 50, 0)
    assert pag["total"] == 582
    assert pag["pagina"] == 1
    assert pag["total_paginas"] == 12
    pag2 = montar_paginacao_lista(582, 50, 50)
    assert pag2["pagina"] == 2
