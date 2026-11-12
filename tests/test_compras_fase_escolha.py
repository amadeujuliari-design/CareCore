"""Fase Pronto para escolher — cotação da Sede."""

from compras_regras import (
    DESTINO_COMPRAS_INFRAESTRUTURA,
    DESTINO_COMPRAS_SUPRIMENTOS,
    MIN_COTACOES_RECOMENDADAS,
    STATUS_AGUARDANDO_ESCOLHA,
    STATUS_AGUARDANDO_SEDE,
    STATUS_AGUARDANDO_UNIDADE,
    STATUS_APROVADO,
    STATUS_COTACAO_SEDE_COLETANDO,
    STATUS_EM_COTACAO,
    TIPO_CONSUMO,
    TIPO_HORTIFRUTI,
    TIPO_MANUTENCAO,
    consumo_escolha_libera_envio_suprimentos,
    pedido_projeto_escolhe_orcamento,
    quem_registrou_escolha_vigente,
    status_depois_de_escolher_cotacao,
    tipo_eh_cotacao_sede,
)


def status_apos_escolha_sede(tipo: str, destino=None) -> str:
    """Espelha a regra de escolher_cotacao para tipos de cotação da Sede."""
    assert tipo_eh_cotacao_sede(tipo)
    return status_depois_de_escolher_cotacao(
        tipo,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
        destino=destino,
    )


def test_status_aguardando_escolha_definido():
    assert STATUS_AGUARDANDO_ESCOLHA == "aguardando_escolha_orcamento"
    assert STATUS_EM_COTACAO in STATUS_COTACAO_SEDE_COLETANDO
    assert STATUS_AGUARDANDO_ESCOLHA not in STATUS_COTACAO_SEDE_COLETANDO
    assert MIN_COTACOES_RECOMENDADAS == 3


def test_hortifruti_apos_escolha_vai_para_sede():
    assert status_apos_escolha_sede(TIPO_HORTIFRUTI) == STATUS_AGUARDANDO_SEDE
    assert status_apos_escolha_sede(TIPO_CONSUMO) == STATUS_AGUARDANDO_UNIDADE
    assert status_apos_escolha_sede(TIPO_MANUTENCAO, DESTINO_COMPRAS_SUPRIMENTOS) == STATUS_AGUARDANDO_UNIDADE


def test_projeto_escolhe_consumo_e_manutencao_suprimentos():
    assert pedido_projeto_escolhe_orcamento(TIPO_CONSUMO)
    assert pedido_projeto_escolhe_orcamento(TIPO_MANUTENCAO, DESTINO_COMPRAS_SUPRIMENTOS)
    assert pedido_projeto_escolhe_orcamento(TIPO_MANUTENCAO, None)
    assert not pedido_projeto_escolhe_orcamento(TIPO_MANUTENCAO, DESTINO_COMPRAS_INFRAESTRUTURA)
    assert not pedido_projeto_escolhe_orcamento(TIPO_HORTIFRUTI)


def test_projeto_ao_escolher_consumo_libera_envio():
    assert status_depois_de_escolher_cotacao(
        TIPO_CONSUMO,
        projeto_escolheu=True,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_APROVADO
    assert status_depois_de_escolher_cotacao(
        TIPO_MANUTENCAO,
        projeto_escolheu=True,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
        destino=DESTINO_COMPRAS_SUPRIMENTOS,
    ) == STATUS_APROVADO
    assert consumo_escolha_libera_envio_suprimentos(
        TIPO_CONSUMO,
        STATUS_AGUARDANDO_UNIDADE,
        tem_escolhida=True,
    )
    assert consumo_escolha_libera_envio_suprimentos(
        TIPO_MANUTENCAO,
        STATUS_AGUARDANDO_UNIDADE,
        tem_escolhida=True,
        destino=DESTINO_COMPRAS_SUPRIMENTOS,
    )
    assert not consumo_escolha_libera_envio_suprimentos(
        TIPO_CONSUMO,
        STATUS_AGUARDANDO_UNIDADE,
        tem_escolhida=False,
    )


def test_quem_escolheu_usa_o_registro_mais_recente():
    assert quem_registrou_escolha_vigente([
        "Projeto escolheu o orçamento vencedor: FEMAPEL (R$ 2255.33).",
        "Cotação liberada para escolha com 2 orçamento(s).",
    ]) == "projeto"
    assert quem_registrou_escolha_vigente([
        "Sede escolheu o orçamento vencedor: FEMAPEL (R$ 10.00).",
    ]) == "sede"
    assert quem_registrou_escolha_vigente([
        "Projeto revogou a escolha de JA e escolheu FEMAPEL (R$ 10.00) como orçamento vencedor.",
    ]) == "projeto"
    assert quem_registrou_escolha_vigente(["Pedido confirmado na timeline."]) is None


def test_suprimentos_reabre_consumo_pelo_perfil_da_sessao():
    from compras_regras import PERFIL_ADM_COMPRAS_SUPRIMENTOS, sede_pode_reabrir_aprovado

    sessao = {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS}
    assert sede_pode_reabrir_aprovado(sessao, TIPO_CONSUMO)
    assert not sede_pode_reabrir_aprovado({"perfil_acesso": "Gestor"}, TIPO_CONSUMO)


def test_orcamento_aprovado_pode_ser_reaberto_antes_do_envio():
    from compras_regras import pode_reabrir_orcamento_aprovado

    assert pode_reabrir_orcamento_aprovado(status=STATUS_APROVADO, pedido_compra_enviado=False)
    assert not pode_reabrir_orcamento_aprovado(status=STATUS_APROVADO, pedido_compra_enviado=True)
    assert not pode_reabrir_orcamento_aprovado(status=STATUS_AGUARDANDO_ESCOLHA, pedido_compra_enviado=False)


def test_sede_ao_escolher_consumo_ainda_aguarda_projeto():
    assert status_depois_de_escolher_cotacao(
        TIPO_CONSUMO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_AGUARDANDO_UNIDADE
    assert status_depois_de_escolher_cotacao(
        TIPO_MANUTENCAO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
        destino=DESTINO_COMPRAS_SUPRIMENTOS,
    ) == STATUS_AGUARDANDO_UNIDADE


def test_infra_apos_reabertura_escolha_volta_para_assinatura():
    from compras_regras import STATUS_AGUARDANDO_SEDE, TIPO_SERVICO, TIPO_IMOBILIZADO

    assert status_depois_de_escolher_cotacao(
        TIPO_SERVICO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_AGUARDANDO_SEDE
    assert status_depois_de_escolher_cotacao(
        TIPO_IMOBILIZADO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_ESCOLHA,
    ) == STATUS_AGUARDANDO_SEDE
    # Já na sede: escolha não muda o status (continua aguardando assinatura).
    assert status_depois_de_escolher_cotacao(
        TIPO_SERVICO,
        projeto_escolheu=False,
        status_atual=STATUS_AGUARDANDO_SEDE,
    ) is None


def test_assinatura_sede_apos_reabertura_sem_aprovado_unidade():
    """Pedido reaberto (flag unidade zerada) continua assinável na Sede."""
    from datetime import datetime

    from compras_regras import (
        STATUS_AGUARDANDO_SEDE,
        TIPO_SERVICO,
        pedido_pronto_para_assinatura_sede_orcamento,
    )

    # Caso Reforma Telhado: aprovado_unidade_em limpo, mas já em Aguardando Sede com escolha.
    assert pedido_pronto_para_assinatura_sede_orcamento(
        escopo_unidade="projeto",
        aprovado_unidade_em=None,
        submetido_em=None,
        status=STATUS_AGUARDANDO_SEDE,
        tem_orcamento_escolhido=True,
        tipo=TIPO_SERVICO,
    )
    # Ainda sem envio e sem escolha: bloqueia.
    assert not pedido_pronto_para_assinatura_sede_orcamento(
        escopo_unidade="projeto",
        aprovado_unidade_em=None,
        submetido_em=None,
        status=STATUS_AGUARDANDO_SEDE,
        tem_orcamento_escolhido=False,
        tipo=TIPO_SERVICO,
    )
    # submetido_em preservado após reabertura antiga também libera.
    assert pedido_pronto_para_assinatura_sede_orcamento(
        escopo_unidade="projeto",
        aprovado_unidade_em=None,
        submetido_em=datetime(2026, 10, 1, 10, 0),
        status=STATUS_AGUARDANDO_SEDE,
        tem_orcamento_escolhido=True,
        tipo=TIPO_SERVICO,
    )
