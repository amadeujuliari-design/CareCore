# -*- coding: utf-8 -*-

from pathlib import Path

import pytest

from compras_patrimonio_planilha import extrair_itens_inventario, nome_unidade_inventario, unidade_eh_sede
from compras_patrimonio_utils import (
    etiqueta_texto,
    normalizar_propriedade,
    normalizar_situacao,
    reais_para_centavos,
)

ROOT = Path(r"c:\Users\AClaudio\Downloads\Arquivos Módulo Compras")
XLSX = ROOT / "INVENTÁRIO PATRIMONIO AEB E PUBLICO (1).xlsx"


def test_etiqueta_e_valor():
    assert etiqueta_texto(20.0) == "20"
    assert reais_para_centavos(132) == 13200
    assert reais_para_centavos("1.330,50") == 133050


def test_propriedade_e_situacao():
    assert normalizar_propriedade("PREF") == "publico"
    assert normalizar_propriedade("AEB") == "aeb"
    assert normalizar_situacao("PÉSSIMO") == "ruim"
    assert normalizar_situacao("BOM ESTADO") == "bom"


def test_nome_unidade_inventario():
    assert unidade_eh_sede("Sede")
    assert "VILA NOVA" in nome_unidade_inventario("F2", "CEI V.N.Cachoeirinha").upper()


@pytest.mark.skipif(not XLSX.exists(), reason="Inventário AEB ausente")
def test_extrair_inventario():
    itens = extrair_itens_inventario(XLSX.read_bytes(), XLSX.name)
    assert len(itens) >= 1500
    assert any(i.escopo_unidade == "sede" for i in itens)
    assert any("SIAT" in i.nome_canonico.upper() for i in itens)
