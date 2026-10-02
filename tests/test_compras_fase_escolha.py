"""Fase Pronto para escolher — cotação da Sede."""

from compras_regras import (
    MIN_COTACOES_RECOMENDADAS,
    STATUS_AGUARDANDO_ESCOLHA,
    STATUS_AGUARDANDO_SEDE,
    STATUS_AGUARDANDO_UNIDADE,
    STATUS_APROVADO,
    STATUS_COTACAO_SEDE_COLETANDO,
    STATUS_EM_COTACAO,
    TIPO_CONSUMO,
    TIPO_HORTIFRUTI,
    consumo_escolha_libera_envio_suprimentos,
    status_depois_de_escolher_cotacao,
    tipo_eh_cotacao_sede,
    tipo_pula_aprovacao_sede,
)


def status_apos_escolha_sede(tipo: str) -> str:
    """Espelha a regra de escolher_cotacao para tipos de cotação da Sede."""
    assert tipo_eh_cotacao_sede(tipo)
    if tipo == TIPO_CONSUMO or tipo_pula_aprovacao_sede(tipo):
        return STATUS_AGUARDANDO_UNIDADE
    return STATUS_AGUARDANDO_SEDE


def test_status_aguardando_escolha_definido():
    assert STATUS_AGUARDANDO_ESCOLHA == "aguardando_escolha_orcamento"
    assert STATUS_EM_COTACAO in STATUS_COTACAO_SEDE_COLETANDO
    assert STATUS_AGUARDANDO_ESCOLHA not in STATUS_COTACAO_SEDE_COLETANDO
    assert MIN_COTACOES_RECOMENDADAS == 3


def test_hortifruti_apos_escolha_vai_para_sede():
    assert status_apos_escolha_sede(TIPO_HORTIFRUTI) == STATUS_AGUARDANDO_SEDE
    assert status_apos_escolha_sede(TIPO_CONSUMO) == STATUS_AGUARDANDO_UNIDADE


def test_projeto_ao_escolher_consumo_libera_envio():
    assert status_depois_de_escolher_cotacao(
        TIPO_CONSUMO,
        projeto_escolheu=True,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_APROVADO
    assert consumo_escolha_libera_envio_suprimentos(
        TIPO_CONSUMO,
        STATUS_AGUARDANDO_UNIDADE,
        tem_escolhida=True,
    )
    assert not consumo_escolha_libera_envio_suprimentos(
        TIPO_CONSUMO,
        STATUS_AGUARDANDO_UNIDADE,
        tem_escolhida=False,
    )


def test_sede_ao_escolher_consumo_ainda_aguarda_projeto():
    assert status_depois_de_escolher_cotacao(
        TIPO_CONSUMO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_AGUARDANDO_UNIDADE
