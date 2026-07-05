"""Testes de perfil operacional por projeto."""
from types import SimpleNamespace

from config_operacional_projeto import projeto_usa_defaults_siat


def test_projeto_siat_por_nome_fantasia():
    projeto = SimpleNamespace(
        nome_fantasia="SIAT II Armênia",
        relatorio_nome_exibicao=None,
        historico_legado_ativo=False,
    )
    assert projeto_usa_defaults_siat(projeto) is True


def test_projeto_generico_novo():
    projeto = SimpleNamespace(
        nome_fantasia="Casa de Acolhida Esperança",
        relatorio_nome_exibicao="Projeto Esperança",
        historico_legado_ativo=False,
    )
    assert projeto_usa_defaults_siat(projeto) is False


def test_projeto_generico_com_historico_legado_ativo():
    projeto = SimpleNamespace(
        nome_fantasia="Casa de Acolhida Esperança",
        relatorio_nome_exibicao=None,
        historico_legado_ativo=True,
    )
    assert projeto_usa_defaults_siat(projeto) is True
