from routers.conviventes_helpers import agregar_resumo_prioridades_ocorrencias


def test_agrega_prioridades_numa_leitura():
    pendentes, criticas, resumo = agregar_resumo_prioridades_ocorrencias([
        ("Baixa", "Resolvido", 2),
        ("Baixa", "Aberto", 1),
        ("Alta", "Aberto", 3),
        ("Crítica", "Resolvido", 4),
        ("Crítica", None, 5),
        ("Outra", "Aberto", 7),
    ])

    assert pendentes == 1 + 3 + 7
    assert criticas == 3
    assert resumo["Baixa"] == {"total": 3, "pendentes": 1}
    assert resumo["Média"] == {"total": 0, "pendentes": 0}
    assert resumo["Alta"] == {"total": 3, "pendentes": 3}
    assert resumo["Crítica"] == {"total": 9, "pendentes": 0}


def test_agrega_vazio_mantem_as_quatro_prioridades():
    pendentes, criticas, resumo = agregar_resumo_prioridades_ocorrencias([])
    assert pendentes == 0
    assert criticas == 0
    assert list(resumo) == ["Baixa", "Média", "Alta", "Crítica"]
