"""Totais Bruto Lojas/CPFs do dashboard NFP."""

from nfp_service import atribuir_retorno_loja_cpf, montar_totais_bruto_lojas_cpf


def test_bruto_lojas_cpfs_soma_rateio_mais_doador():
    out = montar_totais_bruto_lojas_cpf(
        bruto_rateio_agente_centavos=2_214_849,  # 22148.49
        doador_aeb_loja_agente_centavos=116_771,  # 1167.71
        bruto_cpf_agente_centavos=10_868,  # 108.68
    )
    assert out["bruto_lojas_cpfs_centavos"] == 2_331_620  # 23316.20
    assert out["bruto_cpf_centavos"] == 10_868
    assert out["bruto_lojas_centavos"] == 2_320_752  # 23207.52
    assert out["bruto_lojas_centavos"] + out["bruto_cpf_centavos"] == out["bruto_lojas_cpfs_centavos"]


def test_bruto_cpf_nao_ultrapassa_rateio():
    out = montar_totais_bruto_lojas_cpf(1000, 200, 5000)
    assert out["bruto_cpf_centavos"] == 1000
    assert out["bruto_lojas_centavos"] == 200
    assert out["bruto_lojas_cpfs_centavos"] == 1200


def test_sem_cpf():
    out = montar_totais_bruto_lojas_cpf(5000, 1000, 0)
    assert out["bruto_cpf_centavos"] == 0
    assert out["bruto_lojas_centavos"] == 6000
    assert out["bruto_lojas_cpfs_centavos"] == 6000


def test_atribuir_retorno_loja_cpf_consome_saldo():
    restante = {"123": 10868}
    a = atribuir_retorno_loja_cpf(
        origem="DIEGO",
        retorno_centavos=10868,
        cpf_restante_por_cnpj=restante,
        cnpj="123",
    )
    assert a["fonte"] == "CPF"
    assert a["retorno_cpf_centavos"] == 10868
    assert a["retorno_loja_centavos"] == 0
    assert restante["123"] == 0

    b = atribuir_retorno_loja_cpf(
        origem="DIEGO",
        retorno_centavos=38,
        cpf_restante_por_cnpj=restante,
        cnpj="319",
    )
    assert b["fonte"] == "Loja"
    assert b["retorno_cpf_centavos"] == 0

    restante2 = {"319": 20}
    c = atribuir_retorno_loja_cpf(
        origem="DIEGO",
        retorno_centavos=38,
        cpf_restante_por_cnpj=restante2,
        cnpj="319",
    )
    assert c["fonte"] == "Misto"
    assert c["retorno_cpf_centavos"] == 20
    assert c["retorno_loja_centavos"] == 18

    d = atribuir_retorno_loja_cpf(
        origem="DOADOR_AUTOMATICO_DIEGO",
        retorno_centavos=116771,
        cpf_restante_por_cnpj={},
        cnpj="999",
    )
    assert d["fonte"] == "Doador AEB"
    assert d["retorno_loja_centavos"] == 116771
    assert d["retorno_cpf_centavos"] == 0
