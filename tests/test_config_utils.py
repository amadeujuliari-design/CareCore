from config_utils import env_bool, env_float, env_int


def test_env_int_usa_padrao_quando_variavel_ausente(monkeypatch):
    monkeypatch.delenv("CARECORE_TEST_INT", raising=False)

    assert env_int("CARECORE_TEST_INT", 123) == 123


def test_env_int_usa_padrao_quando_valor_invalido(monkeypatch):
    monkeypatch.setenv("CARECORE_TEST_INT", "invalido")

    assert env_int("CARECORE_TEST_INT", 123) == 123


def test_env_int_respeita_valor_minimo(monkeypatch):
    monkeypatch.setenv("CARECORE_TEST_INT", "-5")

    assert env_int("CARECORE_TEST_INT", 123, minimo=0) == 0


def test_env_bool_aceita_valores_verdadeiros(monkeypatch):
    monkeypatch.setenv("CARECORE_TEST_BOOL", "sim")

    assert env_bool("CARECORE_TEST_BOOL") is True


def test_env_bool_usa_padrao_booleano(monkeypatch):
    monkeypatch.delenv("CARECORE_TEST_BOOL", raising=False)

    assert env_bool("CARECORE_TEST_BOOL", True) is True


def test_env_float_usa_padrao_quando_valor_invalido(monkeypatch):
    monkeypatch.setenv("CARECORE_TEST_FLOAT", "invalido")

    assert env_float("CARECORE_TEST_FLOAT", 0.25) == 0.25


def test_env_float_respeita_minimo_e_maximo(monkeypatch):
    monkeypatch.setenv("CARECORE_TEST_FLOAT", "2.5")
    assert env_float("CARECORE_TEST_FLOAT", 0.25, minimo=0.0, maximo=1.0) == 1.0

    monkeypatch.setenv("CARECORE_TEST_FLOAT", "-1")
    assert env_float("CARECORE_TEST_FLOAT", 0.25, minimo=0.0, maximo=1.0) == 0.0
