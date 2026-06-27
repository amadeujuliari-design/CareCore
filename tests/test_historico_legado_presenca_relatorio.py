from datetime import date

from historico_legado_presenca import (
    ID_SERVICO_PRESENCA_LEGADO,
    SERVICO_PRESENCA_LEGADO,
    montar_relatorio_presenca_legado,
    registro_e_presenca_legado,
)


def test_registro_e_presenca_legado():
    assert registro_e_presenca_legado(
        servico_prestado=SERVICO_PRESENCA_LEGADO,
        id_servico_prestado_legado=None,
    )
    assert registro_e_presenca_legado(
        servico_prestado="Outro",
        id_servico_prestado_legado=ID_SERVICO_PRESENCA_LEGADO,
    )
    assert not registro_e_presenca_legado(
        servico_prestado="Lavanderia",
        id_servico_prestado_legado=None,
    )


def test_montar_relatorio_presenca_legado_agrupa_e_marca_dias():
    linhas_brutas = [
        {
            "chave_natural_convivente": "5777500|FULANO|1990-01-01|MAE",
            "id_as_atendimento_legado": "PRESENCA_PDF_2026_06_5777500",
            "nome_convivente": "FULANO DA SILVA",
            "numero_sisa": "5777500",
            "convivente_id": None,
            "data_servico": date(2026, 6, 1),
            "origem_arquivo": "Presencas 06-26.pdf",
            "servico_prestado": SERVICO_PRESENCA_LEGADO,
            "id_servico_prestado_legado": ID_SERVICO_PRESENCA_LEGADO,
            "numero_institucional": None,
        },
        {
            "chave_natural_convivente": "5777500|FULANO|1990-01-01|MAE",
            "id_as_atendimento_legado": "PRESENCA_PDF_2026_06_5777500",
            "nome_convivente": "FULANO DA SILVA",
            "numero_sisa": "5777500",
            "convivente_id": None,
            "data_servico": date(2026, 6, 3),
            "origem_arquivo": "Presencas 06-26.pdf",
            "servico_prestado": SERVICO_PRESENCA_LEGADO,
            "id_servico_prestado_legado": ID_SERVICO_PRESENCA_LEGADO,
            "numero_institucional": None,
        },
        {
            "chave_natural_convivente": "5880666|BELTRANO|1985-05-05|MAE2",
            "id_as_atendimento_legado": "PRESENCA_PDF_2026_06_5880666",
            "nome_convivente": "BELTRANO SOUZA",
            "numero_sisa": "5880666",
            "convivente_id": None,
            "data_servico": date(2026, 6, 2),
            "origem_arquivo": "Presencas 06-26.pdf",
            "servico_prestado": SERVICO_PRESENCA_LEGADO,
            "id_servico_prestado_legado": ID_SERVICO_PRESENCA_LEGADO,
            "numero_institucional": None,
        },
    ]

    relatorio = montar_relatorio_presenca_legado(
        linhas_brutas,
        data_inicio=date(2026, 6, 1),
        data_fim=date(2026, 6, 3),
    )

    assert relatorio["total_pessoas"] == 2
    assert relatorio["resumo"]["presentes"] == 3
    assert relatorio["dias"] == ["2026-06-01", "2026-06-02", "2026-06-03"]

    fulano = next(l for l in relatorio["linhas"] if l["numero_sisa"] == "5777500")
    assert fulano["dias"]["2026-06-01"] == "presente"
    assert fulano["dias"]["2026-06-02"] == "sem_registro"
    assert fulano["dias"]["2026-06-03"] == "presente"
    assert fulano["totais"]["presentes"] == 2

    filtrado = montar_relatorio_presenca_legado(
        linhas_brutas,
        data_inicio=date(2026, 6, 1),
        data_fim=date(2026, 6, 3),
        busca="beltrano",
    )
    assert filtrado["total_pessoas"] == 1
    assert filtrado["linhas"][0]["nome"] == "BELTRANO SOUZA"
