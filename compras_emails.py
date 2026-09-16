"""Textos padrão e assinatura institucional dos e-mails de Compras."""
from __future__ import annotations

import html
from pathlib import Path

from compras_regras import perfil_adm_compras_sede

CORPO_EMAIL_MAX = 8000
CID_ASSINATURA = "assinatura-aeb"

CHAVE_ROBSON = "robson"
CHAVE_ISABELLA = "isabella"

_ASSINATURAS = {
    CHAVE_ROBSON: {
        "arquivo": "robson.jpg",
        "nome": "Robson Roseno",
        "cargo": "Analista de Infraestrutura",
        "setor": "Infraestrutura",
        "email": "infraestrutura@aeb-brasil.org.br",
        "tel_cel": "(11) 94245-0703",
        "tel_fixo": "(11) 2619-5400",
        "endereco": "Rua Sete de Abril, 59, 11º andar – Centro. São Paulo/SP.",
        "site": "www.aeb-brasil.org.br",
        "content_type": "image/jpeg",
    },
    CHAVE_ISABELLA: {
        "arquivo": "isabella.jpg",
        "nome": "Isabella Cordeiro",
        "cargo": "Auxiliar de Suprimentos / ADM",
        "setor": "Suprimentos",
        "email": "suprimentos@aeb-brasil.org.br",
        "tel_cel": "(11) 91681-2822",
        "tel_fixo": "(11) 2619-5400",
        "endereco": "Rua Sete de Abril, 59, 11º andar – Centro. São Paulo/SP.",
        "site": "www.aeb-brasil.org.br",
        "content_type": "image/jpeg",
    },
}

_DIR_ASSINATURAS = Path(__file__).resolve().parent / "compras_email_assinaturas"


def chave_assinatura_usuario(usuario) -> str | None:
    """Robson (Infraestrutura) ou Isabella (Suprimentos); projetos não usam cartão AEB."""
    perfil = perfil_adm_compras_sede(usuario)
    if perfil == "infraestrutura":
        return CHAVE_ROBSON
    if perfil == "suprimentos":
        return CHAVE_ISABELLA
    return None


def sanitizar_corpo_email(texto: str | None, padrao: str) -> str:
    bruto = (texto if texto is not None else padrao) or ""
    limpo = bruto.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not limpo:
        limpo = (padrao or "").strip()
    if len(limpo) > CORPO_EMAIL_MAX:
        limpo = limpo[:CORPO_EMAIL_MAX].rstrip()
    return limpo


def corpo_padrao_solicitacao_cotacao(*, projeto: str, competencia: str) -> str:
    return (
        f"Prezado(a),\n\n"
        f"Solicitamos cotação para o projeto {projeto} (competência {competencia}).\n"
        "Segue em anexo a lista de itens em PDF.\n\n"
        "Responda a este e-mail com o orçamento em PDF.\n\n"
        "— CareCore+ / Compras AEB"
    )


def corpo_padrao_pedido_compra(*, projeto: str, com_orcamento_assinado: bool) -> str:
    if com_orcamento_assinado:
        return (
            f"Segue em anexo o pedido de compra do {projeto} e o orçamento "
            "aprovado/assinado pela Sede (AEB).\n\n"
            "Endereço de entrega conforme documento do pedido.\n\n"
            "— CareCore+ / Compras"
        )
    return (
        f"Segue em anexo o pedido de compra do {projeto}.\n\n"
        "Endereço de entrega conforme documento anexo.\n\n"
        "— CareCore+ / Compras"
    )


def metadados_assinatura(usuario) -> dict | None:
    chave = chave_assinatura_usuario(usuario)
    if not chave:
        return None
    meta = _ASSINATURAS[chave]
    return {
        "chave": chave,
        "nome": meta["nome"],
        "cargo": meta["cargo"],
        "setor": meta["setor"],
        "incluido_automaticamente": True,
        "aviso": (
            f"A assinatura institucional de {meta['nome']} ({meta['setor']}) "
            "será acrescentada automaticamente ao final do e-mail."
        ),
    }


def _caminho_imagem(chave: str) -> Path | None:
    meta = _ASSINATURAS.get(chave)
    if not meta:
        return None
    caminho = _DIR_ASSINATURAS / meta["arquivo"]
    if caminho.is_file():
        return caminho
    return None


def imagens_inline_assinatura(usuario) -> list[dict]:
    chave = chave_assinatura_usuario(usuario)
    if not chave:
        return []
    caminho = _caminho_imagem(chave)
    if caminho is None:
        return []
    meta = _ASSINATURAS[chave]
    return [
        {
            "cid": CID_ASSINATURA,
            "nome": meta["arquivo"],
            "bytes": caminho.read_bytes(),
            "content_type": meta["content_type"],
        }
    ]


def _html_cartao_texto(meta: dict) -> str:
    return (
        '<table cellpadding="0" cellspacing="0" style="font-family:Calibri,Arial,sans-serif;'
        "font-size:13px;color:#334155;margin-top:16px;border-collapse:collapse;"
        'border-top:4px solid #1e5a73">'
        "<tr>"
        '<td style="padding:12px 16px 10px 16px;background:#f1f5f9">'
        f'<div style="font-size:18px;font-weight:700;color:#0f172a">{html.escape(meta["nome"])}</div>'
        f'<div style="font-size:14px;color:#1e5a73;margin-top:2px">{html.escape(meta["cargo"])}</div>'
        "</td></tr>"
        "<tr><td style=\"padding:10px 16px 12px 16px;background:#ffffff\">"
        f'<div>Cel.: {html.escape(meta["tel_cel"])}</div>'
        f'<div>Tel.: {html.escape(meta["tel_fixo"])}</div>'
        f'<div>{html.escape(meta["email"])}</div>'
        f'<div>{html.escape(meta["endereco"])}</div>'
        f'<div><a href="https://{html.escape(meta["site"])}" style="color:#1e5a73">'
        f'{html.escape(meta["site"])}</a></div>'
        "</td></tr></table>"
    )


def montar_corpo_html(texto: str, usuario) -> str:
    blocos = html.escape(texto).replace("\n", "<br>\n")
    chave = chave_assinatura_usuario(usuario)
    if not chave:
        return (
            '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#0f172a;'
            'line-height:1.45">'
            f"{blocos}</div>"
        )
    meta = _ASSINATURAS[chave]
    if _caminho_imagem(chave) is not None:
        assinatura = (
            '<div style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0">'
            f'<img src="cid:{CID_ASSINATURA}" alt="Assinatura {html.escape(meta["nome"])}" '
            'width="520" style="max-width:100%;height:auto;border:0;display:block"/>'
            "</div>"
        )
    else:
        assinatura = _html_cartao_texto(meta)
    return (
        '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#0f172a;'
        'line-height:1.45">'
        f"{blocos}{assinatura}</div>"
    )


def preparar_envio_email_compras(*, usuario, corpo: str | None, padrao: str) -> tuple[str, str, list[dict]]:
    texto = sanitizar_corpo_email(corpo, padrao)
    html_corpo = montar_corpo_html(texto, usuario)
    imagens = imagens_inline_assinatura(usuario)
    return texto, html_corpo, imagens
