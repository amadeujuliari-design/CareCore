# -*- coding: utf-8 -*-

from compras_fornecedor_projetos_utils import (
    montar_rotulo_projetos,
    parsear_projetos_legacy,
    resolver_instituicao_por_token,
    token_indica_geral,
)


def test_token_geral():
    assert token_indica_geral("GERAL")
    assert token_indica_geral("  geral ")


def test_montar_rotulo():
    assert montar_rotulo_projetos(atende_geral=True, nomes=[]) == "GERAL"
    assert montar_rotulo_projetos(atende_geral=False, nomes=["CEI Belém", "SIAT II"]) == "CEI Belém, SIAT II"


def test_parsear_legacy_geral():
    geral, ids = parsear_projetos_legacy("GERAL", [])
    assert geral is True
    assert ids == []


def test_resolver_por_nome_parcial():
    inst = [{"id": "1", "nome": "CEI VILA GUSTAVO"}]
    assert resolver_instituicao_por_token("VILA GUSTAVO", inst) == "1"
