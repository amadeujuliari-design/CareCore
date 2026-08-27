"""Testes unitarios de extracao/analise de cupom NFC-e."""

from nfp_cupom_utils import (
    analisar_html_complementos,
    analisar_html_consumidor,
    cupom_fora_prazo_leitura,
    data_limite_cadastro_sefaz,
    data_limite_leitura_carecore,
    digito_verificador_chave_nfe,
    extrair_chave_de_leitura,
    montar_url_consulta_sp,
    parsear_leitura_cupom,
    qr_indica_cpf_destinatario,
    validar_chave_acesso_nfe,
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

    # Julho: janela ate 20/09 (mes retrasado em setembro) + folga 21/09.
    assert data_limite_cadastro_sefaz(2026, 7) == date(2026, 9, 20)
    assert data_limite_leitura_carecore(2026, 7) == date(2026, 9, 21)
    assert data_limite_cadastro_sefaz(2026, 12) == date(2027, 2, 20)
    assert data_limite_leitura_carecore(2026, 12) == date(2027, 2, 21)
    # Junho em agosto ainda cabe (retrasado ate dia 20).
    assert data_limite_cadastro_sefaz(2026, 6) == date(2026, 8, 20)
    assert cupom_fora_prazo_leitura("2026-06", hoje=date(2026, 8, 13)) is False
    assert cupom_fora_prazo_leitura("2026-06", hoje=date(2026, 8, 20)) is False
    assert cupom_fora_prazo_leitura("2026-06", hoje=date(2026, 8, 21)) is False
    assert cupom_fora_prazo_leitura("2026-06", hoje=date(2026, 8, 22)) is True
    # Maio ja saiu em agosto.
    assert cupom_fora_prazo_leitura("2026-05", hoje=date(2026, 8, 13)) is True
    # Sem ref: nao rejeita por prazo.
    assert cupom_fora_prazo_leitura(None, hoje=date(2026, 8, 22)) is False


def test_parsear_leitura_chave_e_qr_offline():
    chave = "35260847508411169495651090002701871160307536"
    bruto = (
        "https://www.nfce.fazenda.sp.gov.br/nfce/qrcode?"
        f"p={chave}|3|1|01|10.00|2|04817513357|ABC"
    )
    meta = parsear_leitura_cupom(bruto)
    assert meta["cnpj_emitente"] == "47508411169495"
    assert meta["modelo"] == "65"
    assert meta["serie"] == "109"
    assert meta["numero_nf"] == "000270187"
    assert meta["valor_centavos"] == 1000
    assert meta["data_emissao_ref"] == "2026-08"
    assert meta["data_emissao"] == "2026-08-01"
    assert meta["qr_versao"] == "3"
    assert meta["tp_id_dest"] == "2"


def test_html_complementos_valor_e_data():
    html = "<html>Data de emissão 01/08/2026 Valor total 1.234,56 NFC-e</html>"
    extra = analisar_html_complementos(html)
    assert extra["valor_centavos"] == 123456
    assert extra["data_emissao"] == "2026-08-01"


def test_validar_chave_acesso_ok():
    chave = "35260847508411169495651090002701871160307536"
    ok, motivo = validar_chave_acesso_nfe(chave)
    assert ok is True
    assert motivo == ""
    assert digito_verificador_chave_nfe(chave[:43]) == chave[43]


def test_validar_chave_corrompida_modelo_e_mes():
    # Caso real preso em reservado (modelo 51, AAMM 3526 → mes 26).
    chave = "35352607281466770001516500100000197392435549"
    ok, motivo = validar_chave_acesso_nfe(chave)
    assert ok is False
    assert "invalida" in motivo.lower()


def test_validar_chave_dv_errado():
    base = "3526084750841116949565109000270187116030753"
    chave = base + ("0" if digito_verificador_chave_nfe(base) != "0" else "1")
    ok, motivo = validar_chave_acesso_nfe(chave)
    assert ok is False
    assert "verificador" in motivo.lower()

