from credenciais_convivente import (
    criptografar_credencial,
    descriptografar_credencial_armazenado,
)


def test_criptografa_e_descriptografa_credencial():
    segredo = "SenhaGovBr@123"

    armazenado = criptografar_credencial(segredo)

    assert armazenado != segredo
    assert armazenado.startswith("fernet:")
    assert descriptografar_credencial_armazenado(armazenado) == segredo


def test_nao_quebra_valores_legados_em_texto_claro():
    assert descriptografar_credencial_armazenado("senha-antiga") == "senha-antiga"


def test_evitar_dupla_criptografia_quando_ui_reenvia_valor_criptografado():
    segredo = "SenhaEmail@456"
    primeira_gravacao = criptografar_credencial(segredo)
    segunda_gravacao = criptografar_credencial(primeira_gravacao)

    assert segunda_gravacao.startswith("fernet:")
    assert descriptografar_credencial_armazenado(segunda_gravacao) == segredo
