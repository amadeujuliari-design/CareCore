"""Testes da regra de origem do rateio NFP (CNPJ + CPF captado)."""

from nfp_utils import decidir_origem_rateio_credito, origem_eh_rateio_agente


def test_cpf_captado_prioriza_rateio_do_agente():
    origem, captador = decidir_origem_rateio_credito(
        captador_cnpj="DIEGO",
        eh_loja_agente=True,
        eh_doacao_automatica=True,
        captador_cpf="DIEGO",
    )
    assert origem == "DIEGO"
    assert captador == "DIEGO"
    assert origem_eh_rateio_agente(origem) is True


def test_cpf_captado_sem_loja_agente_ainda_rateia():
    origem, captador = decidir_origem_rateio_credito(
        captador_cnpj=None,
        eh_loja_agente=False,
        eh_doacao_automatica=True,
        captador_cpf="OUTRO_AGENTE",
    )
    assert origem == "OUTRO_AGENTE"
    assert captador == "OUTRO_AGENTE"
    assert origem_eh_rateio_agente(origem) is True


def test_doacao_automatica_em_loja_agente_sem_cpf_captado_zera_agente():
    origem, captador = decidir_origem_rateio_credito(
        captador_cnpj="DIEGO",
        eh_loja_agente=True,
        eh_doacao_automatica=True,
        captador_cpf=None,
    )
    assert origem == "DOADOR_AUTOMATICO_DIEGO"
    assert captador == "DIEGO"
    assert origem_eh_rateio_agente(origem) is False


def test_loja_agente_sem_doacao_automatica_rateia():
    origem, captador = decidir_origem_rateio_credito(
        captador_cnpj="DIEGO",
        eh_loja_agente=True,
        eh_doacao_automatica=False,
        captador_cpf=None,
    )
    assert origem == "DIEGO"
    assert captador == "DIEGO"
    assert origem_eh_rateio_agente(origem) is True


def test_doacao_automatica_aeb_sem_cpf_captado():
    origem, captador = decidir_origem_rateio_credito(
        eh_loja_agente=False,
        eh_doacao_automatica=True,
        captador_cpf=None,
    )
    assert origem == "DOADOR_AUTOMATICO_AEB"
    assert captador is None
    assert origem_eh_rateio_agente(origem) is False
