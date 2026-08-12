"""Testes unitarios de extracao/analise de cupom NFC-e."""

from nfp_cupom_utils import (
    analisar_html_consumidor,
    cupom_fora_prazo_leitura,
    data_limite_cadastro_sefaz,
    data_limite_leitura_carecore,
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
    assert "35260847508411169495651090002701871160307536" in url
    assert "p=" in url
    # QR mangled da pistola (sem // e ?) nao deve ser reutilizado.
    mangled = (
        "https:www.nfce.fazenda.sp.gov.brqrcodep="
        "35260818897570000191650040000502359958440126|2|1|1|abc"
    )
    url2 = montar_url_consulta_sp("35260818897570000191650040000502359958440126", mangled)
    assert url2.startswith("https://www.nfce.fazenda.sp.gov.br/")
    assert "no host" not in url2


def test_extrair_chave_url_pistola_mangled():
    mangled = (
        "https:www.nfce.fazenda.sp.gov.brqrcodep="
        "35260818897570000191650040000502359958440126|2|1|1|1896b24f464ba19b9571c0d67ab60"
    )
    assert extrair_chave_de_leitura(mangled) == "35260818897570000191650040000502359958440126"


def test_qr_offline_com_cpf():
    # chave|3|1|dia|valor|2|cpf|hash
    bruto = (
        "https://www.nfce.fazenda.sp.gov.br/nfce/qrcode?"
        "p=35260847508411169495651090002701871160307536|3|1|01|10.00|2|04817513357|ABC"
    )
    assert qr_indica_cpf_destinatario(bruto) is True


def test_prazo_sefaz_e_folga_leitura():
    from datetime import date

    assert data_limite_cadastro_sefaz(2026, 7) == date(2026, 8, 20)
    assert data_limite_leitura_carecore(2026, 7) == date(2026, 8, 21)
    assert data_limite_cadastro_sefaz(2026, 12) == date(2027, 1, 20)
    assert data_limite_leitura_carecore(2026, 12) == date(2027, 1, 21)

    # Ate dia 21 inclusive ainda entra na leitura.
    assert cupom_fora_prazo_leitura("2026-07", hoje=date(2026, 8, 21)) is False
    assert cupom_fora_prazo_leitura("2026-07", hoje=date(2026, 8, 22)) is True
    # Sem ref: nao rejeita por prazo.
    assert cupom_fora_prazo_leitura(None, hoje=date(2026, 8, 22)) is False
