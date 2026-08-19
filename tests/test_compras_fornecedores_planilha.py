# -*- coding: utf-8 -*-

from pathlib import Path

import pytest

from compras_fornecedores_planilha import (
    extrair_linhas_fornecedores,
    linha_para_payload,
    mesclar_payload_fornecedor,
)

ROOT = Path(r"c:\Users\AClaudio\Downloads\Arquivos Módulo Compras")


@pytest.mark.skipif(not ROOT.exists(), reason="Pasta de planilhas AEB ausente")
def test_extrair_fornecedores_xlsx():
    conteudo = (ROOT / "FORNECEDORES_2025 (1).xlsx").read_bytes()
    linhas = extrair_linhas_fornecedores(conteudo, "FORNECEDORES_2025.xlsx")
    assert len(linhas) >= 150
    assert any(l.nome.upper() == "J.A" for l in linhas)
    payload = linha_para_payload(linhas[0])
    assert payload["nome"]


@pytest.mark.skipif(not ROOT.exists(), reason="Pasta de planilhas AEB ausente")
def test_extrair_fornecedores_csv():
    conteudo = (ROOT / "Central_Operacional_AEB_Revisada(Fornecedores).csv").read_bytes()
    linhas = extrair_linhas_fornecedores(conteudo, "fornecedores.csv")
    assert len(linhas) >= 50
    assert linhas[0].contato or linhas[0].telefone


def test_mesclar_segmentos():
    base = {"nome": "J.A", "segmento": "EMERGENCIA TEM TUDO", "ativo": True}
    from compras_fornecedores_planilha import LinhaFornecedorPlanilha

    linha = LinhaFornecedorPlanilha(nome="J.A", segmento="ALIMENTAÇÃO SECA")
    merged = mesclar_payload_fornecedor(base, linha)
    assert "EMERGENCIA" in merged["segmento"]
    assert "ALIMENTAÇÃO" in merged["segmento"]
