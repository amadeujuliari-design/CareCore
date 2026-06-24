import pytest

from atividades_agenda import (
    gerar_datas_ocorrencias_mes,
    mes_referencia_de,
    parse_mes_referencia,
)


def test_gerar_ocorrencias_semanal_terca_quinta_junho_2026():
    datas = gerar_datas_ocorrencias_mes(
        2026,
        6,
        "bisemanal",
        {"dias_semana": [1, 3]},
    )
    assert len(datas) == 9
    assert all(dia.weekday() in {1, 3} for dia in datas)
    assert datas[0] == __import__("datetime").date(2026, 6, 2)


def test_gerar_ocorrencias_dias_mes():
    datas = gerar_datas_ocorrencias_mes(
        2026,
        6,
        "dias_mes",
        {"datas_especificas": ["2026-06-05", "2026-06-12", "2026-07-01"]},
    )
    assert datas == [__import__("datetime").date(2026, 6, 5), __import__("datetime").date(2026, 6, 12)]


def test_parse_mes_referencia():
    assert parse_mes_referencia("2026-06") == (2026, 6)
    assert mes_referencia_de(2026, 6) == "2026-06"


def test_bisemanal_exige_dois_dias():
    with pytest.raises(ValueError):
        gerar_datas_ocorrencias_mes(2026, 6, "bisemanal", {"dias_semana": [1]})
