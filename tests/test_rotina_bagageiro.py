from routers.conviventes import TIPO_ROTINA_BAGAGEIRO, TIPOS_ROTINA_VALIDOS


def test_tipo_movimentacao_bagageiro_aceito_em_rotina():
    assert TIPO_ROTINA_BAGAGEIRO in TIPOS_ROTINA_VALIDOS
