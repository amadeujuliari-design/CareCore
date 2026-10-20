"""Projetos que usam o mesmo menu e a mesma rotina do Reencontro Pari."""

from types import SimpleNamespace

from config_operacional_projeto import (
    projeto_descontinuado,
    projeto_e_cae_i_centro,
    projeto_e_reencontro_pari,
    projeto_sem_fluxo_portaria,
)


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


def test_cae_i_centro_nao_bipa_entrada_e_saida():
    assert projeto_e_cae_i_centro(_projeto("CAE I CENTRO"))
    assert projeto_sem_fluxo_portaria(_projeto("CAE I CENTRO"))
    assert not projeto_e_reencontro_pari(_projeto("CAE I CENTRO"))


def test_modelo_pari_nao_pega_outro_projeto():
    assert not projeto_e_reencontro_pari(_projeto("CASA PORTO"))
    assert not projeto_e_reencontro_pari(None)


def test_cta_liberdade_sai_da_lista():
    assert projeto_descontinuado(_projeto("CTA 17 – LIBERDADE"))
    assert projeto_descontinuado(_projeto("CTA Liberdade"))
    assert not projeto_descontinuado(_projeto("CTA 18 – CANINDÉ"))
    assert not projeto_descontinuado(_projeto("SEDE AEB"))
    assert not projeto_descontinuado(None)


def test_down_town_sai_da_lista():
    assert projeto_descontinuado(_projeto("CAE F DOWN TOWN"))
    assert projeto_descontinuado(_projeto("CAEF - DOWN TOWN"))
    assert projeto_descontinuado(_projeto("DOWNTOWN"))
    assert not projeto_descontinuado(_projeto("CAE I CENTRO"))
