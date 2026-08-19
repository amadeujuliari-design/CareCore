import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path


# Identidade e SMTP Microsoft 365 da AEB (módulo Compras).
SMTP_COMPRAS_FROM_PADRAO = "suprimentos@aeb-brasil.org.br"
SMTP_COMPRAS_HOST_PADRAO = "smtp.office365.com"
SMTP_COMPRAS_PORTA_PADRAO = "587"


@dataclass
class ResultadoEnvioEmail:
    enviado: bool
    erro: str | None = None


def _env(chave: str) -> str:
    return os.getenv(chave, "").strip()


def _credenciais_smtp(*, perfil: str = "suporte") -> dict[str, str]:
    """Suporte = SMTP CareCore. Compras = conta Microsoft 365 da AEB (sem misturar login)."""
    host = _env("CARECORE_SMTP_HOST")
    porta = _env("CARECORE_SMTP_PORT") or "587"
    usuario = _env("CARECORE_SMTP_USER")
    senha = _env("CARECORE_SMTP_PASSWORD")
    remetente = _env("CARECORE_SMTP_FROM") or usuario
    responder_para = _env("CARECORE_SMTP_REPLY_TO")
    copia = ""

    if perfil == "compras":
        remetente = _env("CARECORE_SMTP_COMPRAS_FROM") or SMTP_COMPRAS_FROM_PADRAO
        host = _env("CARECORE_SMTP_COMPRAS_HOST") or SMTP_COMPRAS_HOST_PADRAO
        porta = _env("CARECORE_SMTP_COMPRAS_PORT") or SMTP_COMPRAS_PORTA_PADRAO
        usuario = _env("CARECORE_SMTP_COMPRAS_USER") or remetente
        senha = _env("CARECORE_SMTP_COMPRAS_PASSWORD")
        responder_para = _env("CARECORE_SMTP_COMPRAS_REPLY_TO") or remetente
        copia = _env("CARECORE_SMTP_COMPRAS_COPIA")

    return {
        "host": host,
        "porta": porta,
        "usuario": usuario,
        "senha": senha,
        "remetente": remetente,
        "responder_para": responder_para,
        "copia": copia,
    }


def _anexar_arquivo(mensagem: EmailMessage, *, nome: str, conteudo: bytes, content_type: str) -> None:
    mensagem.add_attachment(
        conteudo,
        maintype=content_type.split("/", 1)[0] if "/" in content_type else "application",
        subtype=content_type.split("/", 1)[1] if "/" in content_type else "octet-stream",
        filename=nome,
    )


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

    destinatario = (para or _env("CARECORE_SUPORTE_EMAIL_DESTINO")).strip()
    cred = _credenciais_smtp(perfil="suporte")
    host = cred["host"]
    porta = int(cred["porta"] or "587")
    usuario = cred["usuario"]
    senha = cred["senha"]
    remetente = cred["remetente"] or destinatario
    responder_para = cred["responder_para"]

    if not destinatario:
        return ResultadoEnvioEmail(False, "Destinatário de suporte não configurado.")

    if not host or not usuario or not senha:
        return ResultadoEnvioEmail(False, "SMTP não configurado.")

    mensagem = EmailMessage()
    mensagem["Subject"] = assunto
    mensagem["From"] = remetente
    mensagem["To"] = destinatario
    if responder_para:
        mensagem["Reply-To"] = responder_para
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


def enviar_email_smtp_com_anexo(
    *,
    assunto: str,
    corpo: str,
    para: str,
    anexo_nome: str,
    anexo_bytes: bytes,
    anexo_content_type: str = "application/pdf",
    perfil: str = "compras",
) -> ResultadoEnvioEmail:
    """Envia e-mail com anexo. Compras autentica na Microsoft 365 da AEB; suporte permanece no SMTP CareCore."""
    _carregar_env_email_local()

    destinatario = (para or "").strip()
    if not destinatario:
        return ResultadoEnvioEmail(False, "Destinatário não informado.")

    cred = _credenciais_smtp(perfil=perfil)
    host = cred["host"]
    porta = int(cred["porta"] or "587")
    usuario = cred["usuario"]
    senha = cred["senha"]
    remetente = cred["remetente"]
    responder_para = cred["responder_para"]
    copia = cred["copia"]

    if not host or not usuario or not senha:
        if perfil == "compras":
            return ResultadoEnvioEmail(
                False,
                "SMTP de Compras (Microsoft 365) não configurado. Informe CARECORE_SMTP_COMPRAS_PASSWORD.",
            )
        return ResultadoEnvioEmail(False, "SMTP não configurado.")

    mensagem = EmailMessage()
    mensagem["Subject"] = assunto
    mensagem["From"] = remetente
    mensagem["To"] = destinatario
    if copia and copia.lower() != destinatario.lower():
        mensagem["Cc"] = copia
    if responder_para:
        mensagem["Reply-To"] = responder_para
    mensagem.set_content(corpo)
    _anexar_arquivo(
        mensagem,
        nome=anexo_nome,
        conteudo=anexo_bytes,
        content_type=anexo_content_type,
    )

    try:
        with smtplib.SMTP(host, porta, timeout=20) as servidor:
            servidor.ehlo()
            servidor.starttls()
            servidor.ehlo()
            servidor.login(usuario, senha)
            servidor.send_message(mensagem)
    except Exception as exc:  # noqa: BLE001
        return ResultadoEnvioEmail(False, str(exc)[:1000])

    return ResultadoEnvioEmail(True)
