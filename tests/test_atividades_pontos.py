from atividades_pontos_service import PONTOS_POR_PRESENCA_ATIVIDADE, _montar_saldo


def test_pontos_por_presenca_constante():
    assert PONTOS_POR_PRESENCA_ATIVIDADE == 1


def test_montar_saldo_convivente():
    saldo = _montar_saldo("c1", total_presencas=5, pontos_utilizados=20)
    assert saldo.total_presencas == 5
    assert saldo.pontos_ganhos == 5
    assert saldo.pontos_utilizados == 20
    assert saldo.saldo_pontos == -15


def test_montar_saldo_sem_resgates():
    saldo = _montar_saldo("c2", total_presencas=3, pontos_utilizados=0)
    assert saldo.pontos_ganhos == 3
    assert saldo.saldo_pontos == 3
