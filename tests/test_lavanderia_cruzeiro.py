"""Grade de 45 minutos da lavanderia do Cruzeiro do Sul."""

from datetime import date, datetime, time

import pytest

from lavanderia_cruzeiro import PADRAO_PARI, proxima_secagem, slots_do_dia, validar_periodos


DIA = date(2026, 10, 6)


def _inicio(hora, minuto, dia=DIA):
    return datetime.combine(dia, time(hora, minuto))


def test_grade_termina_antes_do_almoco_e_das_18():
    horarios = [inicio.time() for inicio, _fim in slots_do_dia(DIA)]
    assert horarios == [
        time(7, 0),
        time(7, 45),
        time(8, 30),
        time(9, 15),
        time(10, 0),
        time(10, 45),
        time(11, 30),
        time(14, 0),
        time(14, 45),
        time(15, 30),
        time(16, 15),
        time(17, 0),
        time(17, 45),
    ]
    assert slots_do_dia(DIA)[6][1].time() == time(12, 15)
    assert slots_do_dia(DIA)[-1][1].time() == time(18, 30)


def test_secagem_entra_no_primeiro_horario_livre_depois_da_lavagem():
    manha = proxima_secagem(_inicio(7, 45), set())
    assert manha[0] == _inicio(7, 45)

    ocupada = proxima_secagem(_inicio(7, 45), {_inicio(7, 45)})
    assert ocupada[0] == _inicio(8, 30)

    depois_do_almoco = proxima_secagem(_inicio(12, 15), set())
    assert depois_do_almoco[0] == _inicio(14, 0)

    mesma_tarde = proxima_secagem(_inicio(17, 45), set())
    assert mesma_tarde[0] == _inicio(17, 45)

    dia_seguinte = proxima_secagem(_inicio(18, 30), set())
    assert dia_seguinte[0] == _inicio(7, 0, date(2026, 10, 7))


def test_periodos_configurados_cortam_o_uso_que_nao_cabe():
    curtos = validar_periodos({
        "manha_inicio": "08:00",
        "manha_fim": "09:30",
        "tarde_inicio": "15:00",
        "tarde_fim": "16:30",
    })
    assert [inicio.time() for inicio, _fim in slots_do_dia(DIA, curtos)] == [
        time(8, 0),
        time(8, 45),
        time(15, 0),
        time(15, 45),
    ]
    seca = proxima_secagem(_inicio(9, 30), set(), periodos=curtos)
    assert seca[0] == _inicio(15, 0)


def test_pari_vai_ate_meia_noite_e_meia():
    horarios = [inicio.time() for inicio, fim in slots_do_dia(DIA, PADRAO_PARI)]
    assert horarios[0] == time(5, 20)
    assert horarios[7] == time(10, 35)
    assert slots_do_dia(DIA, PADRAO_PARI)[7][1].time() == time(11, 20)
    assert horarios[8] == time(14, 0)
    assert horarios[-1] == time(23, 45)
    fim = slots_do_dia(DIA, PADRAO_PARI)[-1][1]
    assert fim == datetime.combine(date(2026, 10, 7), time(0, 30))
    seca = proxima_secagem(fim, set(), periodos=PADRAO_PARI)
    assert seca[0] == datetime.combine(date(2026, 10, 7), time(5, 20))
    assert validar_periodos(PADRAO_PARI.como_dict()).tarde_fim == time(0, 30)


def test_periodo_curto_ou_invertido_e_recusado():
    with pytest.raises(ValueError):
        validar_periodos({
            "manha_inicio": "07:00",
            "manha_fim": "07:30",
            "tarde_inicio": "14:00",
            "tarde_fim": "18:30",
        })
    with pytest.raises(ValueError):
        validar_periodos({
            "manha_inicio": "07:00",
            "manha_fim": "15:00",
            "tarde_inicio": "14:00",
            "tarde_fim": "18:30",
        })
