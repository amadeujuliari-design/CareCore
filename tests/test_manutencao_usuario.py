from manutencao_usuario import NOME_MANUTENCAO_PADRAO, nome_manutencao_configurado


def test_nome_manutencao_usa_padrao_quando_variavel_esta_ausente(monkeypatch):
    monkeypatch.delenv("CARECORE_MANUTENCAO_NOME", raising=False)

    assert nome_manutencao_configurado() == NOME_MANUTENCAO_PADRAO


def test_nome_manutencao_corrige_encoding_quebrado(monkeypatch):
    monkeypatch.setenv("CARECORE_MANUTENCAO_NOME", "Manuten��o CareCore+")

    assert nome_manutencao_configurado() == NOME_MANUTENCAO_PADRAO


def test_nome_manutencao_corrige_mojibake(monkeypatch):
    monkeypatch.setenv("CARECORE_MANUTENCAO_NOME", "ManutenÃ§Ã£o CareCore+")

    assert nome_manutencao_configurado() == NOME_MANUTENCAO_PADRAO
