"""Compat Finance.Pro: create sem id (import WhatsApp) e round-trip."""

from datetime import date

import pytest

from financeiro_compat import (
    transacao_de_finance_pro,
    transacao_para_finance_pro,
)


def test_transacao_create_sem_id_whatsapp():
    """Import WhatsApp envia lote sem id — não pode KeyError."""
    payload = {
        "user_id": "carecore-financas",
        "description": "Mercado (1/2)",
        "amount": 50.0,
        "type": "expense",
        "category": "Outros",
        "responsible": "Claudio",
        "date": "2026-09-08",
        "is_paid": False,
        "origin_file": "WHATSAPP_IMPORT",
        "is_projected": False,
        "whatsapp_cycle_key": "2026-09",
    }
    tx = transacao_de_finance_pro("org-financas", payload)
    assert tx.id is None
    assert tx.descricao == "Mercado (1/2)"
    assert tx.valor == 50.0
    assert tx.data == date(2026, 9, 8)
    assert tx.origem_arquivo == "WHATSAPP_IMPORT"
    assert tx.ciclo_whatsapp == "2026-09"
    assert tx.responsavel == "Claudio"
    assert tx.projetado is False
    assert tx.pago is False


def test_transacao_create_com_id_preserva():
    tx = transacao_de_finance_pro(
        "org-x",
        {
            "id": "abc-123",
            "description": "Teste",
            "amount": 10,
            "type": "expense",
            "date": "2026-01-15",
        },
    )
    assert tx.id == "abc-123"


def test_transacao_sem_data_levanta():
    with pytest.raises(ValueError, match="data"):
        transacao_de_finance_pro(
            "org-x",
            {"description": "Sem data", "amount": 1, "type": "expense"},
        )


def test_transacao_round_trip_campos_whatsapp():
    tx = transacao_de_finance_pro(
        "org-x",
        {
            "id": "w1",
            "description": "Uber",
            "amount": 32.5,
            "type": "expense",
            "date": "2026-09-01",
            "origin_file": "WHATSAPP_IMPORT",
            "whatsapp_cycle_key": "2026-09",
            "responsible": "Léo",
            "is_projected": True,
            "is_paid": False,
        },
    )
    out = transacao_para_finance_pro(tx)
    assert out["origin_file"] == "WHATSAPP_IMPORT"
    assert out["whatsapp_cycle_key"] == "2026-09"
    assert out["responsible"] == "Léo"
    assert out["is_projected"] is True
    assert out["is_paid"] is False
