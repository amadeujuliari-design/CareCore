"""Testes unitários do retrato diário do dashboard operacional."""

from datetime import date

from dashboard_operacional_snapshot import (
    extrair_retrato_para_snapshot,
    montar_serie_grafico,
    periodo_padrao_30_dias,
)


def test_extrair_retrato_guarda_totais_sem_listas_nominais():
    payload = {
        "data_referencia": "2026-07-22",
        "atualizado_em": "2026-07-22T22:05:00",
        "resumo": {
            "dentro_projeto": 40,
            "fora_projeto": 12,
            "total_interacoes_hoje": 90,
        },
        "interacoes_hoje": {"Entrada": 30, "Saída": 20, "Almoço": 40},
        "listas_totais": {"presentes": 40, "fora": 12},
        "alertas": [{"tipo": "x", "titulo": "Atenção"}],
        "presentes": [{"convivente_id": "1"}],
        "fora": [{"convivente_id": "2"}],
    }

    retrato = extrair_retrato_para_snapshot(payload)

    assert retrato["resumo"]["dentro_projeto"] == 40
    assert retrato["resumo"]["fora_projeto"] == 12
    assert retrato["interacoes_hoje"]["Almoço"] == 40
    assert "presentes" not in retrato
    assert "fora" not in retrato
    assert len(retrato["alertas"]) == 1


def test_montar_serie_grafico_ordena_e_usa_dentro_fora():
    items = [
        {
            "data_referencia": "2026-07-21",
            "resumo": {"dentro_projeto": 10, "fora_projeto": 3},
            "interacoes_hoje": {},
        },
        {
            "data_referencia": "2026-07-20",
            "resumo": {"dentro_projeto": 8, "fora_projeto": 5},
            "interacoes_hoje": {},
        },
    ]

    serie = montar_serie_grafico(items, "dentro_projeto")
    assert [p["data"] for p in serie] == ["2026-07-20", "2026-07-21"]
    assert [p["valor"] for p in serie] == [8, 10]

    serie_fora = montar_serie_grafico(items, "fora_projeto")
    assert [p["valor"] for p in serie_fora] == [5, 3]


def test_montar_series_grafico_multiplas():
    items = [
        {
            "data_referencia": "2026-07-20",
            "resumo": {"dentro_projeto": 8, "fora_projeto": 5, "entradas_hoje": 2},
            "interacoes_hoje": {"Entrada": 2},
        },
        {
            "data_referencia": "2026-07-21",
            "resumo": {"dentro_projeto": 10, "fora_projeto": 3, "entradas_hoje": 4},
            "interacoes_hoje": {"Entrada": 4},
        },
    ]
    from dashboard_operacional_snapshot import montar_series_grafico

    series = montar_series_grafico(items, ["dentro_projeto", "fora_projeto"])
    assert set(series.keys()) == {"dentro_projeto", "fora_projeto"}
    assert [p["valor"] for p in series["dentro_projeto"]] == [8, 10]
    assert [p["valor"] for p in series["fora_projeto"]] == [5, 3]


def test_periodo_padrao_30_dias():
    inicio, fim = periodo_padrao_30_dias(hoje=date(2026, 7, 22))
    assert fim == date(2026, 7, 22)
    assert inicio == date(2026, 6, 23)
