"""Projetos que usam o mesmo menu e a mesma rotina do Reencontro Pari."""

from types import SimpleNamespace

from config_operacional_projeto import projeto_e_reencontro_pari


def _projeto(nome: str):
    return SimpleNamespace(nome_fantasia=nome, relatorio_nome_exibicao=None)


def test_modelo_pari_inclui_os_tres_projetos_novos():
    for nome in (
        "REENCONTRO PARI",
        "REENCONTRO ANHANGABAÚ",
        "REENCONTRO CRUZEIRO DO SUL",
        "REENCONTRO JABAQUARA",
    ):
        assert projeto_e_reencontro_pari(_projeto(nome))


def test_modelo_pari_nao_pega_outro_projeto():
    assert not projeto_e_reencontro_pari(_projeto("CASA PORTO"))
    assert not projeto_e_reencontro_pari(None)
