import base64
import json
import os
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path


# Identidade e SMTP Microsoft 365 da AEB (módulo Compras).
SMTP_COMPRAS_FROM_PADRAO = "suprimentos@aeb-brasil.org.br"
SMTP_COMPRAS_HOST_PADRAO = "smtp.office365.com"
SMTP_COMPRAS_PORTA_PADRAO = "587"
GRAPH_MAILBOX_COMPRAS_PADRAO = SMTP_COMPRAS_FROM_PADRAO


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

        if (
            chave.startswith("CARECORE_SMTP_")
            or chave.startswith("CARECORE_GRAPH_")
            or chave == "CARECORE_SUPORTE_EMAIL_DESTINO"
        ):
            if not os.getenv(chave):
                os.environ[chave] = valor


def _credenciais_graph_compras() -> dict[str, str]:
    return {
        "tenant_id": _env("CARECORE_GRAPH_TENANT_ID"),
        "client_id": _env("CARECORE_GRAPH_CLIENT_ID"),
        "client_secret": _env("CARECORE_GRAPH_CLIENT_SECRET"),
        "mailbox": _env("CARECORE_GRAPH_MAILBOX") or GRAPH_MAILBOX_COMPRAS_PADRAO,
        "copia": _env("CARECORE_GRAPH_COPIA") or _env("CARECORE_SMTP_COMPRAS_COPIA"),
    }


def mailbox_graph_compras(mailbox: str | None = None) -> str:
    """Caixa From efetiva no Graph (override do projeto ou mailbox padrão Compras)."""
    _carregar_env_email_local()
    override = (mailbox or "").strip()
    if override:
        return override
    return _credenciais_graph_compras()["mailbox"] or GRAPH_MAILBOX_COMPRAS_PADRAO


def graph_compras_configurado() -> bool:
    cred = _credenciais_graph_compras()
    return bool(cred["tenant_id"] and cred["client_id"] and cred["client_secret"] and cred["mailbox"])


def _graph_obter_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    corpo = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")
    req = urllib.request.Request(token_url, data=corpo, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        dados = json.loads(resp.read().decode("utf-8"))
    token = (dados.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("Token Graph sem access_token.")
    return token


def enviar_email_graph_com_anexo(
    *,
    assunto: str,
    corpo: str,
    para: str,
    anexo_nome: str,
    anexo_bytes: bytes,
    anexo_content_type: str = "application/pdf",
    mailbox: str | None = None,
) -> ResultadoEnvioEmail:
    """Envia e-mail via Microsoft Graph (app Entra + Mail.Send), sem SMTP AUTH."""
    _carregar_env_email_local()

    destinatario = (para or "").strip()
    if not destinatario:
        return ResultadoEnvioEmail(False, "Destinatário não informado.")

    cred = _credenciais_graph_compras()
    if not graph_compras_configurado():
        return ResultadoEnvioEmail(
            False,
            "Graph de Compras não configurado. Informe CARECORE_GRAPH_TENANT_ID, "
            "CARECORE_GRAPH_CLIENT_ID e CARECORE_GRAPH_CLIENT_SECRET.",
        )

    caixa = (mailbox or "").strip() or cred["mailbox"]
    cc = (cred["copia"] or "").strip()
    payload: dict = {
        "message": {
            "subject": assunto,
            "body": {"contentType": "Text", "content": corpo},
            "toRecipients": [{"emailAddress": {"address": destinatario}}],
            "attachments": [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": anexo_nome,
                    "contentType": anexo_content_type or "application/octet-stream",
                    "contentBytes": base64.b64encode(anexo_bytes or b"").decode("ascii"),
                }
            ],
        },
        "saveToSentItems": True,
    }
    if cc and cc.lower() != destinatario.lower():
        payload["message"]["ccRecipients"] = [{"emailAddress": {"address": cc}}]

    try:
        token = _graph_obter_token(cred["tenant_id"], cred["client_id"], cred["client_secret"])
        send_url = (
            "https://graph.microsoft.com/v1.0/users/"
            f"{urllib.parse.quote(caixa)}/sendMail"
        )
        req = urllib.request.Request(
            send_url,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            if resp.status not in (202, 200):
                return ResultadoEnvioEmail(False, f"Graph sendMail status {resp.status}.")
    except urllib.error.HTTPError as exc:
        detalhe = ""
        try:
            detalhe = exc.read().decode("utf-8", errors="replace")[:800]
        except Exception:  # noqa: BLE001
            detalhe = str(exc)
        return ResultadoEnvioEmail(False, f"Graph HTTP {exc.code}: {detalhe}"[:1000])
    except Exception as exc:  # noqa: BLE001
        return ResultadoEnvioEmail(False, str(exc)[:1000])

    return ResultadoEnvioEmail(True)


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
    mailbox: str | None = None,
) -> ResultadoEnvioEmail:
    """Envia e-mail com anexo. Compras: Graph (preferencial) ou SMTP M365; suporte permanece no SMTP CareCore."""
    _carregar_env_email_local()

    destinatario = (para or "").strip()
    if not destinatario:
        return ResultadoEnvioEmail(False, "Destinatário não informado.")

    if perfil == "compras" and graph_compras_configurado():
        return enviar_email_graph_com_anexo(
            assunto=assunto,
            corpo=corpo,
            para=destinatario,
            anexo_nome=anexo_nome,
            anexo_bytes=anexo_bytes,
            anexo_content_type=anexo_content_type,
            mailbox=mailbox,
        )

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
                "Compras: configure Graph (CARECORE_GRAPH_*) ou SMTP "
                "(CARECORE_SMTP_COMPRAS_PASSWORD).",
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
