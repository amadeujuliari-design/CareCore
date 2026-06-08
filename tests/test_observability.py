import observability


class SentryFake:
    def __init__(self):
        self.chamadas = []

    def init(self, **kwargs):
        self.chamadas.append(kwargs)


def test_observabilidade_nao_inicializa_sem_dsn(monkeypatch):
    fake = SentryFake()
    monkeypatch.delenv("CARECORE_SENTRY_DSN", raising=False)
    monkeypatch.setattr(observability, "sentry_sdk", fake)

    assert observability.configurar_observabilidade_carecore() is False
    assert fake.chamadas == []


def test_observabilidade_inicializa_sentry_sem_pii(monkeypatch):
    fake = SentryFake()
    monkeypatch.setenv("CARECORE_SENTRY_DSN", "https://example@sentry.io/1")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CARECORE_SENTRY_TRACES_SAMPLE_RATE", "0.25")
    monkeypatch.setattr(observability, "sentry_sdk", fake)

    assert observability.configurar_observabilidade_carecore() is True

    chamada = fake.chamadas[0]
    assert chamada["dsn"] == "https://example@sentry.io/1"
    assert chamada["environment"] == "production"
    assert chamada["traces_sample_rate"] == 0.25
    assert chamada["send_default_pii"] is False


def test_observabilidade_limita_trace_sample_rate(monkeypatch):
    fake = SentryFake()
    monkeypatch.setenv("CARECORE_SENTRY_DSN", "https://example@sentry.io/1")
    monkeypatch.setenv("CARECORE_SENTRY_TRACES_SAMPLE_RATE", "2")
    monkeypatch.setattr(observability, "sentry_sdk", fake)

    assert observability.configurar_observabilidade_carecore() is True
    assert fake.chamadas[0]["traces_sample_rate"] == 1.0
