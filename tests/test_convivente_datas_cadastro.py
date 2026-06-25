from datetime import date

from convivente_datas_cadastro import (
    STATUS_INATIVOS,
    STATUS_VINCULACAO_ATIVA,
    aplicar_datas_convivente_payload,
    normalizar_prontuario_saude,
    preparar_datas_convivente_criacao,
)


def test_preparar_datas_criacao_padrao_hoje():
    dados = {"status": "Ativo"}
    hoje = date(2026, 6, 24)
    preparar_datas_convivente_criacao(dados, hoje)
    assert dados["data_inclusao"] == hoje


def test_inativacao_automatica_na_mudanca_status():
    dados = {}
    hoje = date(2026, 6, 24)
    aplicar_datas_convivente_payload(dados, "Ativo", "Inativado", hoje, set())
    assert dados["data_inativacao"] == hoje


def test_nova_vinculacao_automatica_apos_inativacao():
    dados = {}
    hoje = date(2026, 6, 25)
    aplicar_datas_convivente_payload(dados, "Inativado", "Ativo", hoje, set())
    assert dados["data_nova_vinculacao"] == hoje


def test_respeita_data_manual_no_payload():
    dados = {}
    manual = date(2020, 1, 15)
    aplicar_datas_convivente_payload(
        dados,
        "Inativado",
        "Ativo",
        date(2026, 6, 25),
        {"data_nova_vinculacao"},
    )
    assert "data_nova_vinculacao" not in dados


def test_normalizar_prontuario_saude():
    assert normalizar_prontuario_saude("  ABC123  ") == "ABC123"
    assert normalizar_prontuario_saude("   ") is None


def test_conjuntos_status():
    assert "Inativado" in STATUS_INATIVOS
    assert "Ativo" in STATUS_VINCULACAO_ATIVA
