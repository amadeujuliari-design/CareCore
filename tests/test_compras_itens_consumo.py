# -*- coding: utf-8 -*-

from compras_itens_consumo_planilha import extrair_itens_consumo
from compras_itens_consumo_utils import chave_item_consumo, filtrar_itens_consumo, limpar_item_consumo, embalagem_efetiva_pedido


def test_chave_ignora_quantidade_e_embalagem():
    assert chave_item_consumo("Álcool 70% 12 un") == "ALCOOL"
    assert chave_item_consumo("Arroz tipo 1 fardo") == "ARROZ"


def test_chave_vazia_usa_fallback():
    assert chave_item_consumo("12 un") == "12 UN"


def test_filtrar_mostra_ao_digitar():
    itens = [
        {"descricao": "Álcool 70%", "marca_preferencial": "Asseptgel", "ativo": True, "categoria_id": "a"},
        {"descricao": "Sabão em pó", "ativo": True, "categoria_id": "a"},
        {"descricao": "Fralda G", "ativo": False, "categoria_id": "b"},
    ]
    achados = filtrar_itens_consumo(itens, busca="al")
    assert len(achados) == 1
    assert achados[0]["descricao"] == "Álcool 70%"


def test_extrair_csv_proposta():
    csv = (
        "descricao,categoria,unidade_medida,marca_preferencial,observacao,tipo,ativo\n"
        "Álcool 70% gel,Higiene e limpeza,un,Asseptgel,,consumo,sim\n"
        "Arroz tipo 1,Alimentação,kg,Camil,,consumo,sim\n"
    ).encode("utf-8-sig")
    linhas = extrair_itens_consumo(csv, "CADASTRO_ITENS_CONSUMO_PROPOSTA.csv")
    assert len(linhas) == 2
    assert linhas[0].descricao.startswith("Álcool")
    assert linhas[0].categoria == "Higiene e limpeza"
    assert linhas[1].marca_preferencial == "Camil"


def test_lixo_quantidade_sem_produto():
    limpo = limpar_item_consumo(descricao="10 Grande E 5 Pequenas")
    assert limpo["lixo"] is True


def test_separa_embalagem_da_descricao():
    alcool = limpar_item_consumo(descricao="ALCOOL GEL para mãos 5L", unidade_medida="un")
    assert alcool["lixo"] is False
    assert alcool["descricao"].lower().startswith("alcool gel")
    assert "5" in (alcool["embalagem"] or "")

    absorvente = limpar_item_consumo(
        descricao="Absorvente Intimus Com abas -PCT 32 un",
        unidade_medida="un",
    )
    assert "PCT" in (absorvente["embalagem"] or "").upper() or "32" in (absorvente["embalagem"] or "")
    assert "pct" not in absorvente["descricao"].lower()

    tnt = limpar_item_consumo(descricao="7M Tnt Azul", unidade_medida="pct")
    assert tnt["lixo"] is False
    assert "Tnt" in tnt["descricao"] or "TNT" in tnt["descricao"].upper()
    assert tnt["embalagem"]

    cola = limpar_item_consumo(descricao="1Kg Perfil De Cola Quente Grossa", observacao="PACOTE")
    assert cola["descricao"].lower().startswith("perfil")
    assert cola["embalagem"]


def test_nao_tira_percentual_nem_linha_do_produto():
    po = limpar_item_consumo(descricao="Chocolate Em Pó 50%")
    assert "50%" in po["descricao"] or "50 %" in po["descricao"]
    apta = limpar_item_consumo(descricao="Aptanutri 3")
    assert "3" in apta["descricao"]
    assert apta["lixo"] is False


def test_obs_caixa_vira_embalagem():
    limpo = limpar_item_consumo(descricao="Absorvente Higienico", observacao="CAIXA COM 60")
    assert limpo["embalagem"]
    assert limpo["observacao"] is None


def test_embalagem_do_pedido_prevalece_sobre_o_cadastro():
    assert embalagem_efetiva_pedido("PCT 1 kg", "PCT 2 kg") == "PCT 1 kg"
    assert embalagem_efetiva_pedido("", "PCT 2 kg") == "PCT 2 kg"
    assert embalagem_efetiva_pedido(None, None) is None
