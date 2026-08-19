# -*- coding: utf-8 -*-

from compras_categoria_utils import (
    mensagem_nome_semelhante,
    nomes_cadastro_semelhantes,
    nomes_sao_semelhantes,
    resolver_nome_cadastro,
)


EXISTENTES = [
    "Alimentação",
    "Carne",
    "Peixe",
    "Higiene e limpeza",
    "Higiene pessoal",
    "EPI",
    "Outros",
]


def test_higiene_curta_bate_nas_duas_existentes():
    achados = nomes_cadastro_semelhantes("Higiene", EXISTENTES)
    assert "Higiene e limpeza" in achados
    assert "Higiene pessoal" in achados


def test_abreviacao_hig_limpeza_reusa_canonica():
    assert nomes_sao_semelhantes("Hig e limpeza", "Higiene e limpeza")
    assert resolver_nome_cadastro("Hig. limpeza", EXISTENTES) == "Higiene e limpeza"


def test_nao_confunde_carne_com_alimentacao():
    assert nomes_cadastro_semelhantes("Carne", EXISTENTES) == []
    assert resolver_nome_cadastro("carne", EXISTENTES) == "Carne"


def test_novo_nome_sem_parente_fica_livre():
    assert resolver_nome_cadastro("Farmácia", EXISTENTES) is None
    assert nomes_cadastro_semelhantes("Farmácia", EXISTENTES) == []


def test_mensagem_aponta_a_existente():
    texto = mensagem_nome_semelhante(tipo="categoria", semelhantes=["Higiene e limpeza"])
    assert "Higiene e limpeza" in texto
    assert "não duplicar" in texto
