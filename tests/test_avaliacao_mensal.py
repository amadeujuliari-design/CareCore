"""Regras da avaliação mensal das Vilas Reencontro."""

from datetime import datetime

from avaliacao_mensal import (
    avaliacao_entra_no_filtro,
    competencia_de,
    competencia_seguinte,
    mensagem_agradecimento,
    mensagem_ja_respondida,
    opcoes_filtro_relatorio,
    perguntas_da_vila,
    validar_respostas,
    vila_por_codigo,
)


def _respostas_completas():
    respostas = {}
    for pergunta in perguntas_da_vila("Vila Reencontro Pari"):
        respostas[pergunta["id"]] = pergunta["opcoes"][0]["id"]
    return respostas


def test_quatro_vilas_e_so_elas():
    assert vila_por_codigo("pari")["rotulo"] == "Vila Reencontro Pari"
    assert vila_por_codigo("ANHANGABAU")["marcador"] == "reencontro anhangabau"
    assert vila_por_codigo("casa-porto") is None


def test_competencia_e_o_mes_informado():
    assert competencia_de(datetime(2026, 10, 9, 9, 30)) == "2026-10"
    assert competencia_seguinte("2026-12") == "2027-01"
    assert competencia_seguinte("2026-10") == "2026-11"


def test_agradecimento_cita_a_vila_escolhida():
    texto = mensagem_agradecimento("Vila Reencontro Pari")
    assert texto.count("Vila Reencontro Pari") == 2
    assert "muito importante" in texto
    assert "você e sua família" in texto
    assert "agradece a sua participação" in texto


def test_mensagem_pede_o_mes_seguinte():
    texto = mensagem_ja_respondida("2026-10")
    assert "outubro de 2026" in texto
    assert "novembro de 2026" in texto
    assert "já foi respondido" in texto


def test_perguntas_usam_a_vila_escolhida_e_as_opcoes_certas():
    perguntas = perguntas_da_vila("Vila Reencontro Jabaquara")
    assert len(perguntas) == 18
    assert "Vila Reencontro Jabaquara" in perguntas[0]["texto"]
    assert [opcao["rotulo"] for opcao in perguntas[0]["opcoes"]] == [
        "Ótimo",
        "Bom",
        "Mais ou menos",
        "Ruim",
    ]
    pessoa = perguntas[11]
    assert "Vila Reencontro" not in pessoa["texto"]
    assert [opcao["rotulo"] for opcao in pessoa["opcoes"]] == [
        "Ótimo",
        "Mais ou menos",
        "Preciso melhorar",
        "Ruim",
    ]
    assert "sua participação nas atividades e eventos" in perguntas[12]["texto"]
    assert "seu respeito com as regras do serviço" in perguntas[16]["texto"]
    juntos = " ".join(pergunta["texto"] for pergunta in perguntas[11:])
    assert "minha " not in juntos
    assert "meu " not in juntos
    assert "meus " not in juntos


def test_filtro_de_resposta_e_de_sugestao():
    respostas = _respostas_completas()
    respostas["alimentacao"] = "ruim"
    assert avaliacao_entra_no_filtro(respostas, "quero mais fruta", resposta_id="ruim")
    assert not avaliacao_entra_no_filtro(respostas, "", resposta_id="bom")
    assert avaliacao_entra_no_filtro(
        respostas,
        "quero mais fruta",
        pergunta_id="alimentacao",
        resposta_id="ruim",
    )
    assert not avaliacao_entra_no_filtro(
        respostas,
        "quero mais fruta",
        pergunta_id="alimentacao",
        resposta_id="otimo",
    )
    assert avaliacao_entra_no_filtro(respostas, "quero mais fruta", sugestoes_filtro="com")
    assert not avaliacao_entra_no_filtro(respostas, "   ", sugestoes_filtro="com")
    assert avaliacao_entra_no_filtro(respostas, "", sugestoes_filtro="sem")
    rotulos = [item["rotulo"] for item in opcoes_filtro_relatorio()]
    assert rotulos == ["Ótimo", "Bom", "Mais ou menos", "Preciso melhorar", "Ruim"]


def test_envio_exige_todas_as_perguntas():
    assert validar_respostas(_respostas_completas()) is None
    incompletas = _respostas_completas()
    del incompletas["capelania"]
    assert validar_respostas(incompletas)
    invalidas = _respostas_completas()
    invalidas["alimentacao"] = "preciso_melhorar"
    assert validar_respostas(invalidas)
