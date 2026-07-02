from datetime import date

import pytest

from rotina_ajustes_totais import (
    TIPOS_AJUSTE_TOTAIS_ROTINA,
    enriquecer_resumo_evolucao_com_ajustes,
    enriquecer_resumo_periodo_historico,
    validar_data_ajuste_permitida,
)


def test_validar_data_ajuste_rejeita_hoje(monkeypatch):
    monkeypatch.setattr(
        "rotina_ajustes_totais.data_operacional_hoje",
        lambda: date(2026, 6, 30),
    )
    with pytest.raises(ValueError):
        validar_data_ajuste_permitida(date(2026, 6, 30))


def test_enriquecer_resumo_evolucao_soma_ajustes():
    resumo = [
        {
            "data": "2026-06-29",
            "atendimentos": 10,
            "entradas": 4,
            "saidas": 3,
            "almocos": 3,
        }
    ]
    ajustes = {
        "2026-06-29": {
            "Entrada": 2,
            "Saída": 1,
            "Almoço": 1,
        }
    }
    resultado = enriquecer_resumo_evolucao_com_ajustes(resumo, ajustes)
    assert len(resultado) == 1
    item = resultado[0]
    assert item["entradas_total"] == 6
    assert item["saidas_total"] == 4
    assert item["almocos_total"] == 4
    assert item["tem_ajuste_manual"] is True


def test_enriquecer_resumo_periodo_historico_soma_ajustes():
    resumo = {
        "total": 10,
        "entradas": 2,
        "saidas": 1,
        "editados": 0,
        "cancelados": 0,
        "retornos_rapidos": 1,
        "contagens_por_tipo": {
            "Entrada": 2,
            "Saída": 1,
            "Almoço": 1,
        },
    }
    ajustes = {
        "Entrada": 258,
        "Saída": 244,
        "Almoço": 170,
    }
    resultado = enriquecer_resumo_periodo_historico(resumo, ajustes)
    assert resultado["total"] == 682
    assert resultado["entradas"] == 260
    assert resultado["saidas"] == 245
    assert resultado["contagens_por_tipo"]["Almoço"] == 171
    assert resultado["tem_ajuste_manual"] is True
    assert resultado["total_complemento_ajuste"] == 672
    assert resultado["total_registrado"] == 10


def test_enriquecer_resumo_periodo_historico_respeita_filtro_tipo():
    resumo = {
        "total": 2,
        "entradas": 2,
        "saidas": 0,
        "contagens_por_tipo": {"Entrada": 2, "Saída": 1},
    }
    ajustes = {"Entrada": 5, "Saída": 9}
    resultado = enriquecer_resumo_periodo_historico(
        resumo,
        ajustes,
        tipo_registro_filtro="Entrada",
    )
    assert resultado["total"] == 7
    assert resultado["entradas"] == 7
    assert resultado["saidas"] == 0
    assert resultado["contagens_por_tipo"]["Entrada"] == 7
    assert resultado["contagens_por_tipo"]["Saída"] == 1


def test_tipos_ajuste_incluem_fluxo_e_refeicoes():
    assert "Entrada" in TIPOS_AJUSTE_TOTAIS_ROTINA
    assert "Almoço" in TIPOS_AJUSTE_TOTAIS_ROTINA
