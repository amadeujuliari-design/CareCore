import pytest
from pydantic import ValidationError

from routers.cobrancas import BoletoManualRequest


def test_boleto_manual_request_valida_escopo_e_valor():
    payload = BoletoManualRequest(
        escopo_documento="projeto",
        valor=1500.5,
        vencimento="2026-07-20",
        fechar_ciclo=True,
        confirmar_divergencia=True,
    )
    assert payload.escopo_documento == "projeto"
    assert payload.valor == 1500.5
    assert payload.fechar_ciclo is True


def test_boleto_manual_request_rejeita_escopo_invalido():
    with pytest.raises(ValidationError):
        BoletoManualRequest(
            escopo_documento="filial",
            valor=10,
            vencimento="2026-07-20",
        )
