"""Projetos que usam o mesmo menu e a mesma rotina do Reencontro Pari."""

from types import SimpleNamespace

from config_operacional_projeto import projeto_e_reencontro_pari, projeto_sem_fluxo_portaria


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


def test_jabaquara_volta_a_ter_entrada_e_saida():
    assert projeto_e_reencontro_pari(_projeto("REENCONTRO JABAQUARA"))
    assert not projeto_sem_fluxo_portaria(_projeto("REENCONTRO JABAQUARA"))
    assert projeto_sem_fluxo_portaria(_projeto("REENCONTRO PARI"))
    assert projeto_sem_fluxo_portaria(_projeto("REENCONTRO ANHANGABAÚ"))
    assert projeto_sem_fluxo_portaria(_projeto("REENCONTRO CRUZEIRO DO SUL"))


def test_modelo_pari_nao_pega_outro_projeto():
    assert not projeto_e_reencontro_pari(_projeto("CASA PORTO"))
    assert not projeto_e_reencontro_pari(None)
