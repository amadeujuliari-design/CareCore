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


def test_casa_porto_forca_rotina_curta_e_sem_controle_de_pecas():
    config = mesclar_config_operacional(
        {
            "refeicoes": {
                "itens": [
                    {
                        "id": "jantar",
                        "nome": "Jantar",
                        "inicio": "17:50",
                        "fim": "20:30",
                        "ativo": True,
                    }
                ]
            },
            "interacoes_rotina": [
                {"valor": "Cobertor", "label": "Cobertor", "grupo": "simples", "ativo": True},
            ],
            "modulos": {"acomodacoes": True, "lavanderia_pecas": True},
        },
        casa_porto=True,
    )
    nomes = [item.nome for item in config.refeicoes.itens]
    valores = [item.valor for item in config.interacoes_rotina]
    tipos = obter_tipos_rotina_validos(config)
    assert nomes == ["Café da manhã", "Almoço", "Lanche da tarde"]
    assert valores == [
        "Banho",
        "Lavanderia",
        "Bipar documentos guardados",
        "Bipar documentos retirados",
    ]
    assert "Jantar" not in tipos
    assert "Lanche noturno" not in tipos
    assert "Cobertor" not in tipos
    assert "Lavanderia" in tipos
    assert "Lanche da tarde" in tipos
    assert config.modulos.acomodacoes is False
    assert config.modulos.pertences_recolhidos is False
    assert config.modulos.lavanderia_pecas is False


def test_reencontro_fica_so_com_as_quatro_refeicoes():
    config = mesclar_config_operacional(
        {
            "refeicoes": {
                "itens": [
                    {
                        "id": "lanche",
                        "nome": "Lanche noturno",
                        "inicio": "21:00",
                        "fim": "22:30",
                        "ativo": True,
                    }
                ]
            },
            "interacoes_rotina": [
                {"valor": "Banho", "label": "Banho", "grupo": "simples", "ativo": True},
                {"valor": "Bagageiro", "label": "Bagageiro (entrada/saída)", "grupo": "par_bagageiro", "ativo": True},
            ],
        },
        reencontro=True,
    )
    nomes = [item.nome for item in config.refeicoes.itens]
    tipos = obter_tipos_rotina_validos(config)
    assert nomes == ["Café da manhã", "Almoço", "Café da tarde", "Jantar"]
    assert config.interacoes_rotina == []
    assert "Café da tarde" in tipos
    assert "Lanche noturno" not in tipos
    assert "Banho" not in tipos
    assert "Entrada" in tipos
    assert "Saída" in tipos


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
