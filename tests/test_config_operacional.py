"""Testes da configuração operacional por projeto."""
from config_operacional import (
    InteracaoRotinaItem,
    mesclar_config_operacional,
    montar_config_operacional_padrao,
    obter_tipos_refeicao_ativos,
    obter_tipos_rotina_validos,
    modulo_acompanhamento_ativo,
)


def test_config_padrao_mantem_historico_legado_siat():
    config = montar_config_operacional_padrao(siat=True)
    assert config.modulos.historico_legado is True


def test_config_padrao_generico_sem_historico_legado():
    config = montar_config_operacional_padrao(siat=False)
    assert config.modulos.historico_legado is False
    assert "SIAT" not in config.documentos.termo_compromisso.titulo
    assert "AEB" not in config.documentos.termo_lgpd.texto


def test_config_padrao_mantem_refeicoes_siat():
    config = montar_config_operacional_padrao()
    refeicoes = obter_tipos_refeicao_ativos(config)
    assert "Café da manhã" in refeicoes
    assert "Almoço" in refeicoes
    assert "Jantar" in refeicoes
    assert "Lanche noturno" in refeicoes


def test_config_sem_refeicoes_remove_tipos_refeicao():
    config = montar_config_operacional_padrao()
    config.refeicoes.habilitadas = False
    refeicoes = obter_tipos_refeicao_ativos(config)
    tipos = obter_tipos_rotina_validos(config)
    assert refeicoes == set()
    assert "Café da manhã" not in tipos
    assert "Entrada" in tipos
    assert "Saída" in tipos


def test_mesclar_config_parcial_preserva_defaults():
    config = mesclar_config_operacional(
        {
            "portaria": {"hora_saida_padrao": "18:00"},
            "modulos": {"historico_legado": True},
        }
    )
    assert config.portaria.hora_saida_padrao == "18:00"
    assert config.portaria.hora_entrada_padrao == "19:00"
    assert config.modulos.historico_legado is True


def test_modulo_acompanhamento_desligado():
    config = montar_config_operacional_padrao()
    config.modulos.pot = False
    assert modulo_acompanhamento_ativo(config, "pot") is False
    assert modulo_acompanhamento_ativo(config, "transferencias") is True


def test_interacao_par_customizada_entra_nos_tipos_validos():
    config = montar_config_operacional_padrao()
    config.interacoes_rotina.append(
        InteracaoRotinaItem(
            valor="Roupa",
            label="Roupa de cama",
            grupo="par",
            ativo=True,
            tipo_retirada="Retirada de Roupa",
            tipo_entrega="Entrega de Roupa",
        )
    )
    tipos = obter_tipos_rotina_validos(config)
    assert "Retirada de Roupa" in tipos
    assert "Entrega de Roupa" in tipos
