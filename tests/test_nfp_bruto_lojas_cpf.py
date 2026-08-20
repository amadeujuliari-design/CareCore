"""Totais Bruto Lojas/CPFs do dashboard NFP."""

from nfp_service import montar_totais_bruto_lojas_cpf


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
