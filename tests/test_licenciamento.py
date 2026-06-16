from datetime import date, datetime, timedelta

from licenciamento import (
    _cobranca_esta_bloqueada,
    _liberacao_temporaria_ativa,
    _payload_usuario_manutencao,
    _rota_livre,
)


class CicloFake:
    def __init__(self, status_pagamento, data_vencimento):
        self.status_pagamento = status_pagamento
        self.data_vencimento = data_vencimento


def test_rota_cobrancas_fica_livre_para_regularizacao():
    assert _rota_livre("/api/cobrancas/organizacao/historico")


def test_rota_suporte_fica_livre_para_atendimento():
    assert _rota_livre("/api/suporte/chamados")


def test_payload_manutencao_nao_deve_ser_bloqueado_por_licenca():
    assert _payload_usuario_manutencao({
        "perfil_acesso": "Manutenção",
        "is_manutencao": True,
    })


def test_cobranca_vencida_bloqueia_sistema():
    bloqueada, motivo = _cobranca_esta_bloqueada(
        [CicloFake("Vencido", date(2026, 7, 5))],
        dias_tolerancia=5,
        hoje=date(2026, 7, 6),
    )

    assert bloqueada is True
    assert "Fatura vencida" in motivo


def test_cobranca_pendente_so_bloqueia_apos_tolerancia():
    dentro_do_prazo, _ = _cobranca_esta_bloqueada(
        [CicloFake("Pendente", date(2026, 7, 5))],
        dias_tolerancia=5,
        hoje=date(2026, 7, 10),
    )
    bloqueada, motivo = _cobranca_esta_bloqueada(
        [CicloFake("Pendente", date(2026, 7, 5))],
        dias_tolerancia=5,
        hoje=date(2026, 7, 11),
    )

    assert dentro_do_prazo is False
    assert bloqueada is True
    assert "tolerância" in motivo


def test_cobranca_paga_nao_bloqueia():
    bloqueada, motivo = _cobranca_esta_bloqueada(
        [CicloFake("Pago", date(2026, 7, 5))],
        dias_tolerancia=5,
        hoje=date(2026, 8, 1),
    )

    assert bloqueada is False
    assert motivo == "Cobranças sem pendência bloqueante."


def test_liberacao_temporaria_ativa_libera_bloqueio():
    class LiberacaoFake:
        ativo = True
        liberado_ate = datetime.utcnow() + timedelta(days=1)

    ativa, motivo = _liberacao_temporaria_ativa(LiberacaoFake())

    assert ativa is True
    assert "Liberação temporária ativa" in motivo


def test_liberacao_temporaria_expirada_nao_libera_bloqueio():
    class LiberacaoFake:
        ativo = True
        liberado_ate = datetime.utcnow() - timedelta(minutes=1)

    ativa, _ = _liberacao_temporaria_ativa(LiberacaoFake())

    assert ativa is False
