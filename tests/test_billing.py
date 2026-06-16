from datetime import date, datetime

import pytest

from billing import (
    DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO,
    cadastro_conta_para_faturamento,
    calcular_rateio_organizacao,
    calcular_mensalidade,
    contar_cadastros_faturaveis,
    convivente_conta_para_faturamento,
    desconto_percentual_degrau,
    valor_bloco_degrau,
)


def test_ativo_sempre_conta():
    fechamento = date(2026, 3, 31)
    assert cadastro_conta_para_faturamento(
        ativo=True,
        inativado_em=None,
        data_fechamento=fechamento,
    )


def test_inativo_15_dias_antes_nao_conta():
    fechamento = date(2026, 3, 31)
    inativado = date(2026, 3, 16)
    assert not cadastro_conta_para_faturamento(
        ativo=False,
        inativado_em=inativado,
        data_fechamento=fechamento,
    )


def test_inativo_14_dias_antes_ainda_conta():
    fechamento = date(2026, 3, 31)
    inativado = date(2026, 3, 17)
    assert cadastro_conta_para_faturamento(
        ativo=False,
        inativado_em=inativado,
        data_fechamento=fechamento,
    )


def test_inativo_sem_data_nao_conta():
    assert not cadastro_conta_para_faturamento(
        ativo=False,
        inativado_em=None,
        data_fechamento=date(2026, 3, 31),
    )


def test_contar_cadastros_faturaveis():
    fechamento = date(2026, 3, 31)
    cadastros = [
        {"ativo": True, "inativado_em": None},
        {"ativo": False, "inativado_em": datetime(2026, 3, 17)},
        {"ativo": False, "inativado_em": datetime(2026, 3, 16)},
    ]
    assert contar_cadastros_faturaveis(cadastros, fechamento) == 2


def test_convivente_ativo_conta():
    assert convivente_conta_para_faturamento(
        status="Ativo",
        inativado_em=None,
        data_fechamento=date(2026, 3, 31),
    )


def test_mensalidade_3000_com_transicao_ate_teto_75():
    assert calcular_mensalidade(3000) == 8875.0


def test_mensalidade_5000_com_teto_75():
    assert calcular_mensalidade(5000) == 11375.0


def test_mensalidade_500_sem_desconto():
    assert calcular_mensalidade(500) == 2500.0


def test_mensalidade_600_com_primeiro_desconto_de_5_por_cento():
    assert desconto_percentual_degrau(6) == 5.0
    assert valor_bloco_degrau(6) == 475.0
    assert calcular_mensalidade(600) == 2975.0


def test_desconto_chega_a_75_por_cento_no_bloco_de_3000():
    assert desconto_percentual_degrau(30) == 75.0
    assert valor_bloco_degrau(30) == 125.0


def test_organizacao_ate_500_cadastros_cobra_projetos_por_bloco_individual():
    rateio = calcular_rateio_organizacao([
        {
            "projeto_id": "p1",
            "projeto_nome": "Projeto 1",
            "conviventes_faturaveis": 215,
            "usuarios_faturaveis": 5,
            "cadastros_faturaveis": 220,
        },
        {
            "projeto_id": "p2",
            "projeto_nome": "Projeto 2",
            "conviventes_faturaveis": 87,
            "usuarios_faturaveis": 3,
            "cadastros_faturaveis": 90,
        },
    ])

    assert rateio["modo"] == "individual_por_projeto"
    assert rateio["total_cadastros_faturaveis"] == 310
    assert rateio["valor_total_mensalidade"] == 2000.0
    assert rateio["projetos"][0]["valor_mensalidade"] == 1500.0
    assert rateio["projetos"][1]["valor_mensalidade"] == 500.0
    assert rateio["projetos"][0]["percentual_rateio"] is None
    assert rateio["projetos"][0]["conviventes_faturaveis"] == 215
    assert rateio["projetos"][0]["usuarios_faturaveis"] == 5


def test_organizacao_acima_de_500_cadastros_rateia_pelo_total_exato():
    rateio = calcular_rateio_organizacao([
        {"projeto_id": "p1", "projeto_nome": "Projeto 1", "cadastros_faturaveis": 220},
        {"projeto_id": "p2", "projeto_nome": "Projeto 2", "cadastros_faturaveis": 90},
        {"projeto_id": "p3", "projeto_nome": "Projeto 3", "cadastros_faturaveis": 330},
    ])

    assert rateio["modo"] == "rateio_organizacao"
    assert rateio["total_cadastros_faturaveis"] == 640
    assert rateio["valor_total_mensalidade"] == 3393.64
    assert [projeto["valor_mensalidade"] for projeto in rateio["projetos"]] == [
        1166.56,
        477.23,
        1749.85,
    ]
    assert round(sum(projeto["valor_mensalidade"] for projeto in rateio["projetos"]), 2) == 3393.64


def test_constante_carencia():
    assert DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO == 15
