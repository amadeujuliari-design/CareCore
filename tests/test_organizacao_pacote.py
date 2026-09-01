from organizacao_pacote import (
    TIPO_PACOTE_ASSISTENCIAL,
    TIPO_PACOTE_FINANCEIRO_PESSOAL,
    normalizar_tipo_pacote,
)


def test_normalizar_tipo_pacote_padrao():
    assert normalizar_tipo_pacote(None) == TIPO_PACOTE_ASSISTENCIAL
    assert normalizar_tipo_pacote("") == TIPO_PACOTE_ASSISTENCIAL
    assert normalizar_tipo_pacote("assistencial") == TIPO_PACOTE_ASSISTENCIAL


def test_normalizar_tipo_pacote_financeiro():
    assert normalizar_tipo_pacote("financeiro_pessoal") == TIPO_PACOTE_FINANCEIRO_PESSOAL


def test_normalizar_tipo_pacote_invalido_volta_assistencial():
    assert normalizar_tipo_pacote("outro") == TIPO_PACOTE_ASSISTENCIAL
