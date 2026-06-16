from routers import organizacoes


def test_upload_local_relatorios_bloqueado_em_producao(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")

    assert not organizacoes._upload_local_relatorios_permitido()


def test_upload_local_relatorios_permitido_em_ambiente_local(monkeypatch):
    monkeypatch.setenv("APP_ENV", "local")

    assert organizacoes._upload_local_relatorios_permitido()
