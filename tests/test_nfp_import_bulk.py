"""Testes de importacao NFP: bulk, bloqueados e batimento."""
from nfp_service import _montar_registros_batimento, _preparar_linhas_sefaz
from nfp_utils import situacao_credito_bloqueada


def test_situacao_credito_bloqueada():
    assert situacao_credito_bloqueada("Bloqueado") is True
    assert situacao_credito_bloqueada("bloqueado") is True
    assert situacao_credito_bloqueada("Liberado") is False
    assert situacao_credito_bloqueada("Calculado") is False
    assert situacao_credito_bloqueada("") is False


def test_preparar_linhas_sefaz_exclui_bloqueados():
    headers = [
        "CNPJ emit.",
        "Emitente",
        "No.",
        "Data Emissão",
        "Valor NF",
        "Data Registro",
        "Créditos",
        "Situação do Crédito",
    ]
    dados = [
        {
            "CNPJ emit.": "11.222.333/0001-81",
            "Emitente": "Loja A",
            "No.": "100",
            "Data Emissão": "15/01/2026",
            "Valor NF": "10,00",
            "Data Registro": "15/01/2026",
            "Créditos": "1,00",
            "Situação do Crédito": "Liberado",
        },
        {
            "CNPJ emit.": "11.222.333/0001-81",
            "Emitente": "Loja A",
            "No.": "101",
            "Data Emissão": "15/01/2026",
            "Valor NF": "20,00",
            "Data Registro": "15/01/2026",
            "Créditos": "2,00",
            "Situação do Crédito": "Bloqueado",
        },
        {
            "CNPJ emit.": "11.222.333/0001-81",
            "Emitente": "Loja B",
            "No.": "102",
            "Data Emissão": "16/01/2026",
            "Valor NF": "30,00",
            "Data Registro": "16/01/2026",
            "Créditos": "3,00",
            "Situação do Crédito": "Liberado",
        },
    ]
    registros, _pares, competencia, ignorados, linhas_arquivo = _preparar_linhas_sefaz(
        headers, dados, "org-1", None
    )
    assert competencia == "2026-05"
    assert linhas_arquivo == 3
    assert ignorados == 1
    assert len(registros) == 2
    assert all(r["situacao_credito"] != "Bloqueado" for r in registros)


def test_montar_batimento_produto_cartesiano_por_chave():
    doacoes = [
        {
            "id": "d1",
            "cpf_doador_cadastrador": "11111111111",
            "cnpj_estabelecimento": "11222333000181",
            "numero_nota": "100",
            "data_nota": "01/01/2026",
            "valor_nota_centavos": 1000,
        },
        {
            "id": "d2",
            "cpf_doador_cadastrador": "22222222222",
            "cnpj_estabelecimento": "11222333000181",
            "numero_nota": "100",
            "data_nota": "02/01/2026",
            "valor_nota_centavos": 2000,
        },
    ]
    sefaz = [
        {
            "id": "s1",
            "cnpj_emitente": "11222333000181",
            "emitente": "Loja A",
            "numero_nota": "100",
            "data_emissao": "01/01/2026",
            "valor_nf_centavos": 1000,
            "creditos_centavos": 50,
        },
        {
            "id": "s2",
            "cnpj_emitente": "11.222.333/0001-81",
            "emitente": "Loja A",
            "numero_nota": "100",
            "data_emissao": "02/01/2026",
            "valor_nf_centavos": 2000,
            "creditos_centavos": 80,
        },
    ]
    rows = _montar_registros_batimento(doacoes, sefaz, "org-1", "2026-05")
    # 2 doacoes x 2 sefaz na mesma chave = 4 batimentos
    assert len(rows) == 4
    assert {r["ocorrencia"] for r in rows if r["id_doacao"] == "d1"} == {1, 2}
    assert all(r["organizacao_id"] == "org-1" for r in rows)
    assert all(r["competencia"] == "2026-05" for r in rows)


def test_montar_batimento_sem_match():
    doacoes = [
        {
            "id": "d1",
            "cpf_doador_cadastrador": "11111111111",
            "cnpj_estabelecimento": "00000000000000",
            "numero_nota": "999",
            "data_nota": "01/01/2026",
            "valor_nota_centavos": 100,
        }
    ]
    sefaz = [
        {
            "id": "s1",
            "cnpj_emitente": "11222333000181",
            "emitente": "Loja",
            "numero_nota": "100",
            "data_emissao": "01/01/2026",
            "valor_nf_centavos": 100,
            "creditos_centavos": 10,
        }
    ]
    assert _montar_registros_batimento(doacoes, sefaz, "org", "2026-03") == []
