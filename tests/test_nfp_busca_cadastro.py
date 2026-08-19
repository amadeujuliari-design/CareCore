from nfp_utils import numero_cadastro_da_busca


def test_numero_cadastro_ignora_cnpj_completo():
    assert numero_cadastro_da_busca("62401963000588") is None
    assert numero_cadastro_da_busca("62.401.963/0005-88") is None


def test_numero_cadastro_aceita_sequencial():
    assert numero_cadastro_da_busca("16") == 16
    assert numero_cadastro_da_busca("0") == 0


def test_numero_cadastro_ignora_cpf_completo():
    assert numero_cadastro_da_busca("12345678901") is None
