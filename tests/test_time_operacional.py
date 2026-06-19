from datetime import datetime, time

from time_operacional import agora_operacional_naive, parse_data_filtro_operacional


def test_parse_data_filtro_operacional_inicio_do_dia():
    resultado = parse_data_filtro_operacional("2026-06-18", fim_do_dia=False)
    assert resultado == datetime(2026, 6, 18, 0, 0, 0)


def test_parse_data_filtro_operacional_fim_do_dia():
    resultado = parse_data_filtro_operacional("2026-06-18", fim_do_dia=True)
    assert resultado == datetime.combine(datetime(2026, 6, 18).date(), time.max)


def test_agora_operacional_naive_eh_naive():
    agora = agora_operacional_naive()
    assert agora.tzinfo is None
