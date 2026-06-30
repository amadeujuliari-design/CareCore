from texto_revisao_privacidade import (
    MENSAGEM_NOMES_REVISAO,
    MENSAGEM_NOMES_REVISAO_OCORRENCIA,
    detectar_nomes_proprios_no_texto,
    montar_fragmentos_nomes_cadastrados,
)


def test_montar_fragmentos_nomes_cadastrados():
    fragmentos = montar_fragmentos_nomes_cadastrados(
        ["João da Silva", "Maria"],
        ["Ana Paula Souza"],
    )
    assert "joao da silva" in fragmentos
    assert "joao" in fragmentos
    assert "ana paula souza" in fragmentos


def test_detectar_nome_cadastrado_no_texto():
    fragmentos = montar_fragmentos_nomes_cadastrados(["João Silva"], [])
    encontrados = detectar_nomes_proprios_no_texto(
        "Conflito",
        "O acolhido discutiu com João Silva no refeitório.",
        fragmentos,
    )
    assert "joao silva" in [item.casefold() for item in encontrados]


def test_detectar_nome_heuristico_nao_cadastrado():
    encontrados = detectar_nomes_proprios_no_texto(
        "Relato",
        "Houve desentendimento com Carlos no quarto 12.",
        set(),
    )
    assert any("carlos" in item.casefold() for item in encontrados)


def test_nao_bloqueia_palavras_permitidas():
    encontrados = detectar_nomes_proprios_no_texto(
        "",
        "Convivente apresentou crise comportamental no refeitório.",
        set(),
    )
    assert encontrados == []


def test_nao_bloqueia_aviso_institucional_com_palavras_capitalizadas():
    titulo = "Inteligência Artificial no CARECORE+?"
    texto = (
        "Nova ferramenta em Comunicação → Avisos e Ocorrências.\n"
        "Digite o texto, clique em Revisar texto e leia a sugestão.\n"
        "Use o campo Funcionários envolvidos em ocorrências."
    )
    encontrados = detectar_nomes_proprios_no_texto(
        titulo,
        texto,
        montar_fragmentos_nomes_cadastrados([], []),
        usar_fragmentos_cadastrados=True,
        usar_heuristica_nomes=False,
    )
    assert encontrados == []


def test_bloqueia_aviso_com_nome_cadastrado():
    fragmentos = montar_fragmentos_nomes_cadastrados([], ["Maria Santos"])
    encontrados = detectar_nomes_proprios_no_texto(
        "Aviso",
        "Informamos que a técnica Maria Santos estará de férias.",
        fragmentos,
        usar_fragmentos_cadastrados=True,
        usar_heuristica_nomes=False,
    )
    assert any("maria" in item.casefold() for item in encontrados)


def test_mensagem_bloqueio_definida():
    assert "nomes próprios" in MENSAGEM_NOMES_REVISAO.lower()
    assert "funcionários envolvidos" in MENSAGEM_NOMES_REVISAO_OCORRENCIA.lower()


def test_nao_bloqueia_aviso_reuniao_com_fragmentos_dos_e_nao_possui():
    fragmentos = montar_fragmentos_nomes_cadastrados(
        ["NAO POSSUI"],
        ["JANETE DIAS DOS SANTOS"],
    )
    texto = (
        "ola equipe\n"
        "gostaria de avisar sobre nossa reuniao de planejamente que acontecera dia 02/07/2026 "
        "as 11 horas, a reunião será em regime de turnos de 30 minutos para que o projeto "
        "nao fique sem atendimento, no primeiro deveremos ter 4 técnicos e 4 orientadores e "
        "assim sucetivamente, conto com a presentça de todos, se organizem entre vcs e me "
        "enviem até o final do espediente do dia amanha quem participara dos turnos. obrigado"
    )
    encontrados = detectar_nomes_proprios_no_texto("", texto, fragmentos)
    assert encontrados == []

    encontrados_aviso = detectar_nomes_proprios_no_texto(
        "",
        texto,
        fragmentos,
        usar_fragmentos_cadastrados=True,
        usar_heuristica_nomes=False,
    )
    assert encontrados_aviso == []
