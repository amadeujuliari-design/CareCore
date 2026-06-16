import pytest
from fastapi import HTTPException

from datetime import date, datetime, timedelta

from routers.cobrancas import (
    CobrancaTesteAsaasRequest,
    LiberacaoTemporariaRequest,
    SimularStatusCobrancaRequest,
    cobrancas_automacao_config,
    classificar_status_operacao_financeira,
    data_fechamento_padrao,
    data_vencimento_ciclo,
    exigir_usuario_manutencao_financeira,
    exigir_usuario_pode_ver_cobrancas,
    extrair_referencia_ciclo_asaas,
    limpar_documento_asaas,
    resumo_alerta_cobrancas,
    simulacoes_cobranca_ativas,
    status_asaas_do_webhook,
    status_pagamento_asaas_para_carecore,
)


def test_payload_cobranca_teste_limpa_documento():
    payload = CobrancaTesteAsaasRequest(cpf_cnpj="249.715.637-92")

    assert payload.cpf_cnpj == "24971563792"


def test_payload_cobranca_teste_normaliza_billing_type():
    payload = CobrancaTesteAsaasRequest(billing_type="pix")

    assert payload.billing_type == "PIX"


def test_payload_cobranca_teste_rejeita_cartao_nesta_fase():
    with pytest.raises(ValueError):
        CobrancaTesteAsaasRequest(billing_type="CREDIT_CARD")


def test_global_pode_ver_cobrancas():
    exigir_usuario_pode_ver_cobrancas({"is_global": True, "perfil_acesso": "Global"})


def test_gestor_pode_ver_cobrancas():
    exigir_usuario_pode_ver_cobrancas({"perfil_acesso": "Gestor"})


def test_orientador_nao_pode_ver_cobrancas():
    with pytest.raises(HTTPException):
        exigir_usuario_pode_ver_cobrancas({"perfil_acesso": "Orientador"})


def test_fechamento_padrao_usa_dia_25_do_mes_corrente_ate_o_dia_25():
    assert data_fechamento_padrao(date(2026, 6, 15)) == date(2026, 6, 25)
    assert data_fechamento_padrao(date(2026, 6, 25)) == date(2026, 6, 25)


def test_fechamento_padrao_vira_para_proximo_mes_depois_do_dia_25():
    assert data_fechamento_padrao(date(2026, 6, 26)) == date(2026, 7, 25)


def test_vencimento_ciclo_e_dia_5_do_mes_seguinte():
    assert data_vencimento_ciclo(date(2026, 6, 25)) == date(2026, 7, 5)
    assert data_vencimento_ciclo(date(2026, 12, 25)) == date(2027, 1, 5)


def test_limpar_documento_asaas_remove_formatacao():
    assert limpar_documento_asaas("12.345.678/0001-90") == "12345678000190"


def test_status_pagamento_asaas_para_carecore():
    assert status_pagamento_asaas_para_carecore("PENDING") == "Pendente"
    assert status_pagamento_asaas_para_carecore("RECEIVED") == "Pago"
    assert status_pagamento_asaas_para_carecore("OVERDUE") == "Vencido"
    assert status_pagamento_asaas_para_carecore("CANCELLED") == "Cancelado"


def test_status_asaas_do_webhook_usa_status_do_payload():
    assert status_asaas_do_webhook("PAYMENT_RECEIVED", {"status": "CONFIRMED"}) == "CONFIRMED"


def test_status_asaas_do_webhook_infere_status_pelo_evento():
    assert status_asaas_do_webhook("PAYMENT_OVERDUE", {}) == "OVERDUE"
    assert status_asaas_do_webhook("PAYMENT_RECEIVED", {}) == "RECEIVED"
    assert status_asaas_do_webhook("PAYMENT_CANCELLED", {}) == "CANCELLED"


def test_extrair_referencia_ciclo_asaas():
    assert extrair_referencia_ciclo_asaas({"externalReference": "carecore-ciclo-abc"}) == "abc"
    assert extrair_referencia_ciclo_asaas({"externalReference": "outro"}) is None


def test_simulacoes_cobranca_ativas_por_flag(monkeypatch):
    monkeypatch.setenv("CARECORE_COBRANCAS_SIMULACAO_ATIVA", "false")
    assert simulacoes_cobranca_ativas() is False

    monkeypatch.setenv("CARECORE_COBRANCAS_SIMULACAO_ATIVA", "true")
    assert simulacoes_cobranca_ativas() is True


def test_automacao_cobrancas_fica_desligada_por_padrao(monkeypatch):
    monkeypatch.delenv("CARECORE_COBRANCAS_FECHAMENTO_AUTOMATICO_ATIVO", raising=False)
    monkeypatch.delenv("CARECORE_COBRANCAS_GERACAO_ASAAS_AUTOMATICA", raising=False)

    config = cobrancas_automacao_config()

    assert config["preparado"] is True
    assert config["fechamento_automatico_ativo"] is False
    assert config["geracao_asaas_automatica"] is False


def test_automacao_cobrancas_liga_apenas_por_flag(monkeypatch):
    monkeypatch.setenv("CARECORE_COBRANCAS_FECHAMENTO_AUTOMATICO_ATIVO", "true")
    monkeypatch.setenv("CARECORE_COBRANCAS_GERACAO_ASAAS_AUTOMATICA", "true")
    monkeypatch.setenv("CARECORE_COBRANCAS_DIA_FECHAMENTO", "99")

    config = cobrancas_automacao_config()

    assert config["fechamento_automatico_ativo"] is True
    assert config["geracao_asaas_automatica"] is True
    assert config["dia_fechamento"] == 31


def test_payload_simular_status_normaliza_status_asaas():
    payload = SimularStatusCobrancaRequest(status_asaas="received")

    assert payload.status_asaas == "RECEIVED"


def test_payload_simular_status_rejeita_status_desconhecido():
    with pytest.raises(ValueError):
        SimularStatusCobrancaRequest(status_asaas="UNKNOWN")


def test_resumo_alerta_cobrancas_identifica_fatura_vencida():
    class Ciclo:
        status_pagamento = "Vencido"
        data_vencimento = date(2026, 7, 5)
        id = "ciclo-1"

    resumo = resumo_alerta_cobrancas([Ciclo()])

    assert resumo["possui_fatura_vencida"] is True
    assert resumo["total_faturas_vencidas"] == 1
    assert resumo["ciclo_mais_antigo_vencido_id"] == "ciclo-1"


def test_payload_liberacao_temporaria_exige_motivo_relevante():
    with pytest.raises(ValueError):
        LiberacaoTemporariaRequest(dias=3, motivo="curto")


def test_manutencao_pode_acessar_operacao_financeira():
    exigir_usuario_manutencao_financeira({"perfil_acesso": "Manutenção"})


def test_global_nao_acessa_operacao_financeira_manutencao():
    with pytest.raises(HTTPException):
        exigir_usuario_manutencao_financeira({"perfil_acesso": "Global", "is_global": True})


def test_classificar_status_operacao_financeira_bloqueada_por_vencida():
    class Ciclo:
        status_pagamento = "Vencido"
        data_vencimento = date(2026, 7, 5)

    status = classificar_status_operacao_financeira([Ciclo()], None)

    assert status["status"] == "Bloqueada"


def test_classificar_status_operacao_financeira_liberada_temporariamente():
    class Liberacao:
        ativo = True
        liberado_ate = datetime.utcnow() + timedelta(days=2)

    status = classificar_status_operacao_financeira([], Liberacao())

    assert status["status"] == "Liberada temporariamente"
