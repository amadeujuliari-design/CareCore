from datetime import date, datetime

import pytest

from billing import (
    DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO,
    cadastro_conta_para_faturamento,
    calcular_mensalidade,
    contar_cadastros_faturaveis,
    convivente_conta_para_faturamento,
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


def test_constante_carencia():
    assert DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO == 15
