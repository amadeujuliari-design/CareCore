from ordenacao_natural import chave_ordenacao_natural


def test_chave_ordenacao_natural_ordena_numeros_corretamente():
    nomes = ["Quarto 10", "Quarto 2", "Quarto 1", "Ala A"]
    ordenados = sorted(nomes, key=chave_ordenacao_natural)
    assert ordenados == ["Ala A", "Quarto 1", "Quarto 2", "Quarto 10"]


def test_chave_ordenacao_natural_normaliza_hifen():
    a = "Ala Masculina - Quarto / QR1 ISOLAMENTE"
    b = "Ala Masculina -Acessibilidade - Quarto"
    ordenados = sorted([a, b], key=chave_ordenacao_natural)
    assert ordenados[0] == b


def test_chave_ordenacao_natural_ordena_leitos():
    leitos = ["Cama 10", "Cama 2", "Cama 1"]
    ordenados = sorted(leitos, key=chave_ordenacao_natural)
    assert ordenados == ["Cama 1", "Cama 2", "Cama 10"]
