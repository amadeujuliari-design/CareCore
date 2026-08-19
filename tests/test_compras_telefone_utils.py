# -*- coding: utf-8 -*-

import pytest

from compras_telefone_utils import (
    extrair_telefones_compras,
    formatar_telefone_compras,
    sanitizar_telefone_compras,
    telefone_compras_valido,
)


def test_celular_sem_ddd_recebe_11():
    assert sanitizar_telefone_compras("98106-1470") == ("11981061470", [])


def test_fixo_sem_ddd_recebe_11():
    assert sanitizar_telefone_compras("3312-3505") == ("1133123505", [])


def test_ja_com_ddd_mantem():
    assert sanitizar_telefone_compras("(11) 97762-7329") == ("11977627329", [])


def test_multiplos_telefones():
    principal, extras = sanitizar_telefone_compras("(11)98301-0444  (11)2287-6530")
    assert principal == "11983010444"
    assert extras == ["1122876530"]


def test_com_codigo_pais():
    assert sanitizar_telefone_compras("55 11 91088-2792")[0] == "11910882792"


def test_formatar_exibicao():
    assert formatar_telefone_compras("98106-1470") == "(11) 98106-1470"


def test_telefone_curto_invalido():
    assert sanitizar_telefone_compras("(46) 5627-53") == (None, [])


def test_validacao():
    assert telefone_compras_valido("11981061470") is True
    assert telefone_compras_valido("98106") is False
    assert telefone_compras_valido("") is True
