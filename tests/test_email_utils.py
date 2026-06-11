import email_utils


class _SMTPFake:
    mensagem_enviada = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def ehlo(self):
        return None

    def starttls(self):
        return None

    def login(self, usuario, senha):
        return None

    def send_message(self, mensagem):
        _SMTPFake.mensagem_enviada = mensagem


def test_enviar_email_smtp_inclui_reply_to(monkeypatch):
    monkeypatch.setenv("CARECORE_SUPORTE_EMAIL_DESTINO", "destino@example.com")
    monkeypatch.setenv("CARECORE_SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("CARECORE_SMTP_PORT", "587")
    monkeypatch.setenv("CARECORE_SMTP_USER", "usuario@example.com")
    monkeypatch.setenv("CARECORE_SMTP_PASSWORD", "senha")
    monkeypatch.setenv("CARECORE_SMTP_FROM", "suporte@carecoreplus.com.br")
    monkeypatch.setenv("CARECORE_SMTP_REPLY_TO", "respostas@example.com")
    monkeypatch.setattr(email_utils.smtplib, "SMTP", _SMTPFake)

    resultado = email_utils.enviar_email_smtp(
        assunto="Teste",
        corpo="Corpo",
    )

    assert resultado.enviado
    assert _SMTPFake.mensagem_enviada["From"] == "suporte@carecoreplus.com.br"
    assert _SMTPFake.mensagem_enviada["Reply-To"] == "respostas@example.com"
