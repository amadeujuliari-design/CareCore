import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path


@dataclass
class ResultadoEnvioEmail:
    enviado: bool
    erro: str | None = None


def _carregar_env_email_local() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for linha in env_path.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue

        chave, valor = linha.split("=", 1)
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")

        if chave.startswith("CARECORE_SMTP_") or chave == "CARECORE_SUPORTE_EMAIL_DESTINO":
            if not os.getenv(chave):
                os.environ[chave] = valor


def enviar_email_smtp(*, assunto: str, corpo: str, para: str | None = None) -> ResultadoEnvioEmail:
    """
    Envia e-mail por SMTP quando as variáveis de ambiente estiverem configuradas.

    A função é intencionalmente tolerante: se não houver configuração ou se o
    provedor falhar, retorna o erro para registro, mas não deve impedir fluxos
    principais como abertura de chamado.
    """
    _carregar_env_email_local()

    destinatario = (para or os.getenv("CARECORE_SUPORTE_EMAIL_DESTINO") or "").strip()
    host = os.getenv("CARECORE_SMTP_HOST", "").strip()
    porta = int(os.getenv("CARECORE_SMTP_PORT", "587") or "587")
    usuario = os.getenv("CARECORE_SMTP_USER", "").strip()
    senha = os.getenv("CARECORE_SMTP_PASSWORD", "").strip()
    remetente = (
        os.getenv("CARECORE_SMTP_FROM", "").strip()
        or usuario
        or destinatario
    )

    if not destinatario:
        return ResultadoEnvioEmail(False, "Destinatário de suporte não configurado.")

    if not host or not usuario or not senha:
        return ResultadoEnvioEmail(False, "SMTP não configurado.")

    mensagem = EmailMessage()
    mensagem["Subject"] = assunto
    mensagem["From"] = remetente
    mensagem["To"] = destinatario
    mensagem.set_content(corpo)

    try:
        with smtplib.SMTP(host, porta, timeout=20) as servidor:
            servidor.ehlo()
            servidor.starttls()
            servidor.ehlo()
            servidor.login(usuario, senha)
            servidor.send_message(mensagem)
    except Exception as exc:  # noqa: BLE001 - erro precisa ser registrado no chamado
        return ResultadoEnvioEmail(False, str(exc)[:1000])

    return ResultadoEnvioEmail(True)
