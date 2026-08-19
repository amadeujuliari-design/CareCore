import pytest

from compras_nf_xml_utils import extrair_campos_nf_xml
from compras_pedido_pdf import montar_html_pedido_compra
from compras_regras import aviso_cotacoes_insuficientes, pedido_pronto_para_aprovacao_unidade


SAMPLE_NFE = b"""<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35250812345678000190550010000000015123456789">
      <ide>
        <nNF>12345</nNF>
        <serie>1</serie>
        <dhEmi>2026-08-17T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Fornecedor Teste LTDA</xNome>
      </emit>
      <total>
        <ICMSTot>
          <vNF>1500.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>
"""


def test_extrair_campos_nf_xml():
    campos = extrair_campos_nf_xml(SAMPLE_NFE)
    assert campos["numero"] == "12345"
    assert campos["serie"] == "1"
    assert campos["emitente_nome"] == "Fornecedor Teste LTDA"
    assert campos["valor_centavos"] == 150050
    assert campos["origem_dados"] == "xml"


def test_aviso_cotacoes():
    assert aviso_cotacoes_insuficientes(3) is None
    assert "faltam" in (aviso_cotacoes_insuficientes(1) or "")


def test_imobilizado_pode_avancar_com_uma_cotacao():
    assert pedido_pronto_para_aprovacao_unidade("imobilizado", 1, True)
    assert not pedido_pronto_para_aprovacao_unidade("imobilizado", 1, False)


def test_pedido_compra_mostra_embalagem():
    html = montar_html_pedido_compra(
        pedido={"competencia": "2026-08", "tipo": "consumo"},
        instituicao=None,
        organizacao_nome="AEB",
        itens=[{
            "quantidade": 10,
            "unidade_medida": "un",
            "descricao": "Farinha de tapioca",
            "embalagem": "500 g",
            "marca_preferencial": None,
        }],
        cotacao_escolhida=None,
        numero_pedido="ABC123",
    )
    assert "Embalagem" in html
    assert "500 g" in html
    assert "Farinha de tapioca" in html
