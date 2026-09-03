from compras_patrimonio_utils import (
    chave_categoria_patrimonio_por_descricao,
    resolver_categoria_patrimonio_id,
)


CATS = [
    {"id": "ti", "nome": "Eletrônicos / Informática / TI"},
    {"id": "eletro", "nome": "Eletrodomésticos"},
    {"id": "moveis", "nome": "Móveis"},
    {"id": "equip", "nome": "Equipamentos"},
    {"id": "bem", "nome": "Bem / imobilizado"},
]


def test_chave_moveis():
    assert chave_categoria_patrimonio_por_descricao("Mesa de madeira") == "moveis"
    assert chave_categoria_patrimonio_por_descricao("02 Cadeiras estofadas") == "moveis"


def test_chave_eletro():
    assert chave_categoria_patrimonio_por_descricao("Geladeira Consul") == "eletrodomesticos"
    assert chave_categoria_patrimonio_por_descricao("Ventilador de Parede") == "eletrodomesticos"


def test_chave_eletronicos():
    assert chave_categoria_patrimonio_por_descricao('TV LD 65" SMART UHD') == "eletronicos"
    assert chave_categoria_patrimonio_por_descricao("DATA SHOW epson") == "eletronicos"


def test_chave_equipamentos_e_fallback():
    assert chave_categoria_patrimonio_por_descricao("Cilindro oxigenio") == "equipamentos"
    assert chave_categoria_patrimonio_por_descricao("VASO DECORATIVO") == "bem"


def test_resolver_id():
    assert resolver_categoria_patrimonio_id("Armário 2 portas", CATS) == "moveis"
    assert resolver_categoria_patrimonio_id("Notebook Acer", CATS) == "ti"
    assert resolver_categoria_patrimonio_id("Objeto estranho XYZ", CATS) == "bem"
