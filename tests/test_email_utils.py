import base64
import json
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


def _sem_graph(monkeypatch):
    monkeypatch.setattr(email_utils, "_carregar_env_email_local", lambda: None)
    for chave in (
        "CARECORE_GRAPH_TENANT_ID",
        "CARECORE_GRAPH_CLIENT_ID",
        "CARECORE_GRAPH_CLIENT_SECRET",
        "CARECORE_GRAPH_MAILBOX",
        "CARECORE_GRAPH_COPIA",
    ):
        monkeypatch.delenv(chave, raising=False)


def test_enviar_email_smtp_inclui_reply_to(monkeypatch):
    _sem_graph(monkeypatch)
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


def test_compras_usa_identidade_aeb_sem_misturar_suporte(monkeypatch):
    _sem_graph(monkeypatch)
    monkeypatch.setenv("CARECORE_SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setenv("CARECORE_SMTP_PORT", "587")
    monkeypatch.setenv("CARECORE_SMTP_USER", "usuario@example.com")
    monkeypatch.setenv("CARECORE_SMTP_PASSWORD", "senha-carecore")
    monkeypatch.setenv("CARECORE_SMTP_FROM", "suporte@carecoreplus.com.br")
    monkeypatch.setenv("CARECORE_SMTP_REPLY_TO", "respostas@example.com")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_HOST", "smtp.office365.com")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_USER", "suprimentos@aeb-brasil.org.br")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_PASSWORD", "senha-microsoft")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_FROM", "suprimentos@aeb-brasil.org.br")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_REPLY_TO", "suprimentos@aeb-brasil.org.br")
    monkeypatch.delenv("CARECORE_SMTP_COMPRAS_COPIA", raising=False)
    monkeypatch.setattr(email_utils.smtplib, "SMTP", _SMTPFake)

    cred = email_utils._credenciais_smtp(perfil="compras")
    assert cred["host"] == "smtp.office365.com"
    assert cred["usuario"] == "suprimentos@aeb-brasil.org.br"
    assert cred["senha"] == "senha-microsoft"

    resultado = email_utils.enviar_email_smtp_com_anexo(
        assunto="Pedido",
        corpo="Anexo",
        para="fornecedor@example.com",
        anexo_nome="pedido.html",
        anexo_bytes=b"<html></html>",
        anexo_content_type="text/html",
        perfil="compras",
    )

    assert resultado.enviado
    assert _SMTPFake.mensagem_enviada["From"] == "suprimentos@aeb-brasil.org.br"
    assert _SMTPFake.mensagem_enviada["Reply-To"] == "suprimentos@aeb-brasil.org.br"
    assert _SMTPFake.mensagem_enviada["To"] == "fornecedor@example.com"
    assert _SMTPFake.mensagem_enviada.get("Cc") is None


def test_compras_nao_reusa_senha_do_smtp_de_suporte(monkeypatch):
    _sem_graph(monkeypatch)
    monkeypatch.setenv("CARECORE_SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setenv("CARECORE_SMTP_USER", "usuario@example.com")
    monkeypatch.setenv("CARECORE_SMTP_PASSWORD", "senha-carecore")
    monkeypatch.delenv("CARECORE_SMTP_COMPRAS_PASSWORD", raising=False)
    monkeypatch.delenv("CARECORE_SMTP_COMPRAS_HOST", raising=False)
    monkeypatch.delenv("CARECORE_SMTP_COMPRAS_USER", raising=False)

    resultado = email_utils.enviar_email_smtp_com_anexo(
        assunto="Pedido",
        corpo="Anexo",
        para="fornecedor@example.com",
        anexo_nome="pedido.html",
        anexo_bytes=b"<html></html>",
        perfil="compras",
    )

    assert not resultado.enviado
    assert "Graph" in (resultado.erro or "") or "SMTP" in (resultado.erro or "")


def test_compras_copia_segundo_email_quando_configurado(monkeypatch):
    _sem_graph(monkeypatch)
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_HOST", "smtp.office365.com")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_USER", "suprimentos@aeb-brasil.org.br")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_PASSWORD", "senha-microsoft")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_FROM", "suprimentos@aeb-brasil.org.br")
    monkeypatch.setenv("CARECORE_SMTP_COMPRAS_COPIA", "infraestrutura@aeb-brasil.org.br")
    monkeypatch.setattr(email_utils.smtplib, "SMTP", _SMTPFake)

    resultado = email_utils.enviar_email_smtp_com_anexo(
        assunto="Pedido",
        corpo="Anexo",
        para="fornecedor@example.com",
        anexo_nome="pedido.html",
        anexo_bytes=b"<html></html>",
        perfil="compras",
    )

    assert resultado.enviado
    assert _SMTPFake.mensagem_enviada["Cc"] == "infraestrutura@aeb-brasil.org.br"


class _RespFake:
    def __init__(self, status=200, body=b"{}"):
        self.status = status
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self._body


def test_compras_prefere_graph_quando_configurado(monkeypatch):
    monkeypatch.setattr(email_utils, "_carregar_env_email_local", lambda: None)
    monkeypatch.setenv("CARECORE_GRAPH_TENANT_ID", "tenant-id")
    monkeypatch.setenv("CARECORE_GRAPH_CLIENT_ID", "client-id")
    monkeypatch.setenv("CARECORE_GRAPH_CLIENT_SECRET", "secret")
    monkeypatch.setenv("CARECORE_GRAPH_MAILBOX", "suprimentos@aeb-brasil.org.br")
    monkeypatch.delenv("CARECORE_GRAPH_COPIA", raising=False)

    chamadas = []

    def urlopen_fake(req, timeout=0):
        url = getattr(req, "full_url", None) or req.get_full_url()
        chamadas.append(url)
        if "oauth2" in url:
            return _RespFake(200, json.dumps({"access_token": "tok"}).encode())
        assert req.get_method() == "POST"
        payload = json.loads(req.data.decode())
        assert payload["message"]["toRecipients"][0]["emailAddress"]["address"] == "fornecedor@example.com"
        anexo = payload["message"]["attachments"][0]
        assert anexo["name"] == "pedido.html"
        assert base64.b64decode(anexo["contentBytes"]) == b"<html></html>"
        return _RespFake(202, b"")

    monkeypatch.setattr(email_utils.urllib.request, "urlopen", urlopen_fake)

    resultado = email_utils.enviar_email_smtp_com_anexo(
        assunto="Pedido",
        corpo="Anexo",
        para="fornecedor@example.com",
        anexo_nome="pedido.html",
        anexo_bytes=b"<html></html>",
        anexo_content_type="text/html",
        perfil="compras",
    )

    assert resultado.enviado
    assert any("login.microsoftonline.com" in u for u in chamadas)
    assert any("sendMail" in u for u in chamadas)
