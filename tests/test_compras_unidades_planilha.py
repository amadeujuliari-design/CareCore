# -*- coding: utf-8 -*-

from pathlib import Path

import pytest

from compras_unidades_nome_utils import (
    nome_fantasia_de_aba,
    rotulo_nfp_canonico,
    usa_cnpj_matriz,
)
from compras_unidades_planilha import extrair_unidades_compras_aeb, mesclar_unidades

ROOT = Path(r"c:\Users\AClaudio\Downloads\Arquivos Módulo Compras")


def test_nome_aba_siat():
    assert "SIAT" in nome_fantasia_de_aba("SIAT IIATENDE 3", "SIAT II")


def test_nome_aba_cei_belem():
    assert nome_fantasia_de_aba("CEI BELEM", "CEI BELEM") == "CEI BELÉM"


def test_cnpj_matriz():
    assert usa_cnpj_matriz("61.705.877/0001-72")
    assert not usa_cnpj_matriz("61.705.877/0015-78")


def test_rotulo_nfp():
    assert rotulo_nfp_canonico("CTA CANINDE") == "CTA 18 – CANINDÉ"


@pytest.mark.skipif(not ROOT.exists(), reason="Planilhas AEB ausentes")
def test_extrair_unidades_mescladas():
    unidades = extrair_unidades_compras_aeb()
    assert len(unidades) >= 25
    nomes = {u.nome_fantasia for u in unidades}
    assert any("SIAT" in n for n in nomes)
    assert "CEI BELÉM" in nomes
    siat = next(u for u in unidades if "SIAT" in u.nome_fantasia)
    assert siat.cnpj == "61705877003279"
    assert siat.cep
