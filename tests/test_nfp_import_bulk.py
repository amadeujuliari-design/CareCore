"""Testes de performance/correção do matching de batimento NFP."""
from nfp_service import _montar_registros_batimento


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
