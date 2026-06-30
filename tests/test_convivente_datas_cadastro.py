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


def test_corrigir_data_inclusao_posterior_para_primeira_interacao():
    from convivente_datas_cadastro import corrigir_data_inclusao_apos_primeira_interacao

    primeira = date(2025, 5, 21)
    posterior = date(2026, 6, 30)
    assert corrigir_data_inclusao_apos_primeira_interacao(posterior, primeira) == primeira


def test_corrigir_data_inclusao_mantem_quando_anterior_ou_igual():
    from convivente_datas_cadastro import corrigir_data_inclusao_apos_primeira_interacao

    primeira = date(2025, 5, 21)
    assert corrigir_data_inclusao_apos_primeira_interacao(primeira, primeira) == primeira
    assert corrigir_data_inclusao_apos_primeira_interacao(date(2024, 1, 1), primeira) == date(2024, 1, 1)


def test_corrigir_data_inclusao_sem_primeira_interacao():
    from convivente_datas_cadastro import corrigir_data_inclusao_apos_primeira_interacao

    manual = date(2026, 6, 30)
    assert corrigir_data_inclusao_apos_primeira_interacao(manual, None) == manual


def test_resolver_data_inclusao_posterior_a_primeira_interacao():
    from convivente_datas_cadastro import resolver_data_inclusao_coerente

    primeira = date(2025, 5, 21)
    assert resolver_data_inclusao_coerente(date(2026, 6, 30), date(2020, 1, 1), primeira) == primeira


def test_resolver_data_inclusao_usa_data_entrada_quando_inclusao_ausente():
    from convivente_datas_cadastro import resolver_data_inclusao_coerente

    primeira = date(2025, 5, 21)
    assert resolver_data_inclusao_coerente(None, date(2026, 6, 30), primeira) == primeira


def test_resolver_data_inclusao_mantem_quando_ja_coerente():
    from convivente_datas_cadastro import resolver_data_inclusao_coerente

    primeira = date(2025, 5, 21)
    assert resolver_data_inclusao_coerente(date(2025, 5, 21), date(2026, 6, 30), primeira) is None
    assert resolver_data_inclusao_coerente(date(2024, 1, 1), None, primeira) is None


def test_conjuntos_status():
    assert "Inativado" in STATUS_INATIVOS
    assert "Ativo" in STATUS_VINCULACAO_ATIVA


def test_data_inclusao_suspeita_legado():
    from convivente_datas_cadastro import (
        DATA_INCLUSAO_SUBSTITUTO_LEGADO,
        data_inclusao_suspeita_legado,
        normalizar_data_inclusao_legado,
        resolver_data_inclusao_coerente,
    )

    assert data_inclusao_suspeita_legado(date(2000, 1, 1)) is True
    assert data_inclusao_suspeita_legado(date(206, 2, 5)) is True
    assert data_inclusao_suspeita_legado(date(2020, 1, 1)) is False
    assert normalizar_data_inclusao_legado(date(2000, 1, 1)) == DATA_INCLUSAO_SUBSTITUTO_LEGADO
    assert resolver_data_inclusao_coerente(date(2000, 1, 1), date(2020, 6, 1), None) == date(
        2020, 1, 1
    )
    assert resolver_data_inclusao_coerente(date(206, 2, 5), None, None) == date(2020, 1, 1)
