"""Grade de 45 minutos da lavanderia do Cruzeiro do Sul."""

from datetime import date, datetime, time

from lavanderia_cruzeiro import proxima_secagem, slots_do_dia


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
        time(14, 0),
        time(14, 45),
        time(15, 30),
        time(16, 15),
        time(17, 0),
    ]
    assert slots_do_dia(DIA)[5][1].time() == time(11, 30)
    assert slots_do_dia(DIA)[-1][1].time() == time(17, 45)


def test_secagem_entra_no_primeiro_horario_livre_depois_da_lavagem():
    manha = proxima_secagem(_inicio(7, 45), set())
    assert manha[0] == _inicio(7, 45)

    ocupada = proxima_secagem(_inicio(7, 45), {_inicio(7, 45)})
    assert ocupada[0] == _inicio(8, 30)

    depois_do_almoco = proxima_secagem(_inicio(11, 30), set())
    assert depois_do_almoco[0] == _inicio(14, 0)

    dia_seguinte = proxima_secagem(_inicio(17, 45), set())
    assert dia_seguinte[0] == _inicio(7, 0, date(2026, 10, 7))
