"""Testes unitarios de extracao/analise de cupom NFC-e."""

from nfp_cupom_utils import (
    analisar_html_consumidor,
    extrair_chave_de_leitura,
    montar_url_consulta_sp,
    qr_indica_cpf_destinatario,
)


def test_extrair_chave_de_url_sp():
    url = (
        "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx"
        "?p=35260847508411169495651090002701871160307536%7C3%7C1"
    )
    assert extrair_chave_de_leitura(url) == "35260847508411169495651090002701871160307536"


def test_extrair_chave_somente_digitos():
    assert extrair_chave_de_leitura("3526 0847 5084 1116 9495 6510 9000 2701 8711 6030 7536") == (
        "35260847508411169495651090002701871160307536"
    )


def test_html_consumidor_nao_identificado():
    html = "<html><body><h4>Consumidor</h4><p>Consumidor não identificado</p></body></html>"
    iden, msg = analisar_html_consumidor(html)
    assert iden is False
    assert "nao identificado" in msg.lower() or "não identificado" in msg.lower() or "elegivel" in msg.lower()


def test_html_consumidor_com_cpf_mascarado():
    html = "<html>#### Consumidor * CPF: 048.***.***-57 *</html>"
    iden, _msg = analisar_html_consumidor(html)
    assert iden is True


def test_montar_url_consulta():
    url = montar_url_consulta_sp("35260847508411169495651090002701871160307536")
    assert "35260847508411169495651090002701871160307536|3|1" in url


def test_qr_offline_com_cpf():
    # chave|3|1|dia|valor|2|cpf|hash
    bruto = (
        "https://www.nfce.fazenda.sp.gov.br/nfce/qrcode?"
        "p=35260847508411169495651090002701871160307536|3|1|01|10.00|2|04817513357|ABC"
    )
    assert qr_indica_cpf_destinatario(bruto) is True
