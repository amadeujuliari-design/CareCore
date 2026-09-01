"""Testes conferencia pre-prazo NFP e metadados SEFAZ do robo."""

from __future__ import annotations

from datetime import date

from nfp_conferencia_sefaz_service import executar_batimento, parse_sefaz_registrado_em
from nfp_cupom_utils import janela_aviso_conferencia_sefaz, ultimo_dia_util_antes_do_dia


def test_ultimo_dia_util_antes_do_dia_20():
    # 20/09/2026 = domingo -> volta para sexta 18/09
    assert ultimo_dia_util_antes_do_dia(2026, 9, 20) == date(2026, 9, 18)


def test_janela_aviso_ativa_no_dia_conferencia():
    out = janela_aviso_conferencia_sefaz(date(2026, 9, 18))
    assert out["ativo"] is True
    assert out["refs_emissao_prioridade"] == ["2026-07"]


def test_batimento_cnpj_numero_valor():
    cupons = [
        {
            "chave": "1" * 44,
            "cnpj": "47508411169495",
            "numero": "270187",
            "numero_curto": "270187",
            "valor_cent": 3290,
            "mensagem": "",
            "tipo_retorno_sefaz": "sucesso",
        }
    ]
    pedidos = [
        {
            "cnpj": "47508411169495",
            "numero": "000270187",
            "numero_curto": "270187",
            "data_pedido": "01/09/2026",
            "valor_cent": 3290,
            "status": "OK",
        }
    ]
    resultados, totais = executar_batimento(cupons, pedidos)
    assert totais["ok"] == 1
    assert resultados[0]["situacao"].startswith("OK")


def test_batimento_ja_existe_sem_match_e_duvidoso():
    cupons = [
        {
            "chave": "2" * 44,
            "cnpj": "11111111111111",
            "numero": "999",
            "numero_curto": "999",
            "valor_cent": 100,
            "mensagem": "Este pedido já existe no sistema.",
            "tipo_retorno_sefaz": "ja_existe",
        }
    ]
    resultados, totais = executar_batimento(cupons, [])
    assert totais["duvidoso_ja_existe"] == 1
    assert "DUVIDOSO" in resultados[0]["situacao"]


def test_parse_sefaz_registrado_em():
    dt = parse_sefaz_registrado_em(
        "Doação registrada com sucesso. Aguardando processamento pelo sistema. 01/09/2026 18:30:53"
    )
    assert dt is not None
    assert dt.year == 2026 and dt.month == 9 and dt.day == 1
