"""Utilitarios de leitura de cupom NFC-e / chave de acesso NFP."""

from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html import unescape

RE_CHAVE = re.compile(r"(?<!\d)(\d{44})(?!\d)")
RE_CONSUMIDOR_NAO_ID = re.compile(
    r"consumidor\s*n[aã]o\s*identificado",
    re.I,
)
RE_SECAO_CONSUMIDOR = re.compile(
    r"consumidor(.{0,400})",
    re.I | re.S,
)
RE_CPF_MASCARA = re.compile(
    r"\b\d{3}[.\s]*\*{2,3}[.\s]*\*{2,3}[-\s]*\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\bCPF\b",
    re.I,
)

URL_CONSULTA_SP = (
    "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx"
)


@dataclass
class ResultadoChaveCupom:
    chave: str
    qr_bruto: str
    url_consulta: str | None = None
    cpf_no_qr: bool = False
    consumidor_identificado: bool | None = None
    mensagem: str = ""
    cnpj_emitente: str | None = None
    valor_centavos: int | None = None
    data_emissao: str | None = None


def extrair_chave_de_leitura(bruto: str) -> str | None:
    """Extrai chave de 44 digitos de QR (URL) ou digitacao."""
    texto = (bruto or "").strip()
    if not texto:
        return None

    # URL com p=chave|...
    try:
        parsed = urllib.parse.urlparse(texto)
        qs = urllib.parse.parse_qs(parsed.query)
        if "p" in qs and qs["p"]:
            primeiro = qs["p"][0].split("|")[0]
            digitos = re.sub(r"\D", "", primeiro)
            if len(digitos) == 44:
                return digitos
    except Exception:
        pass

    # p= embutido sem parse completo
    m_p = re.search(r"[?&]p=([^&\s]+)", texto, re.I)
    if m_p:
        parte = urllib.parse.unquote(m_p.group(1)).split("|")[0]
        digitos = re.sub(r"\D", "", parte)
        if len(digitos) == 44:
            return digitos

    digitos = re.sub(r"\D", "", texto)
    if len(digitos) == 44:
        return digitos

    m = RE_CHAVE.search(digitos) or RE_CHAVE.search(texto)
    return m.group(1) if m else None


def qr_indica_cpf_destinatario(bruto: str) -> bool:
    """NFC-e offline (v2/v3): parametros 6/7 do p= podem trazer tipo CPF + numero."""
    texto = (bruto or "").strip()
    m_p = re.search(r"[?&]p=([^&\s]+)", texto, re.I)
    raw = urllib.parse.unquote(m_p.group(1)) if m_p else texto
    partes = raw.split("|")
    if len(partes) < 7:
        return False
    # layouts offline: ...|dia|valor|tpIdDest|idDest|hash
    # indices variam; procura segmento "2" (CPF) seguido de 11 digitos
    for i, parte in enumerate(partes):
        if parte.strip() == "2" and i + 1 < len(partes):
            doc = re.sub(r"\D", "", partes[i + 1])
            if len(doc) == 11:
                return True
    return False


def montar_url_consulta_sp(chave: str, qr_bruto: str = "") -> str:
    bruto = (qr_bruto or "").strip()
    if "nfce.fazenda.sp.gov.br" in bruto.lower() and "p=" in bruto.lower():
        if bruto.startswith("http"):
            return bruto
    return f"{URL_CONSULTA_SP}?p={chave}|3|1"


def _baixar_html_consulta(url: str, timeout: float = 12.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CareCorePlus-NFP/1.0 (+leitura-cupons)",
            "Accept": "text/html,application/xhtml+xml",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def analisar_html_consumidor(html: str) -> tuple[bool | None, str]:
    """
    Retorna (consumidor_identificado, mensagem).
    True = tem CPF/CNPJ consumidor; False = nao identificado; None = inconclusivo.
    """
    texto = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    texto = re.sub(r"\s+", " ", texto)

    if RE_CONSUMIDOR_NAO_ID.search(texto):
        return False, "Consumidor nao identificado (elegivel para doacao manual)."

    m = RE_SECAO_CONSUMIDOR.search(texto)
    if m:
        trecho = m.group(1)
        if RE_CONSUMIDOR_NAO_ID.search(trecho):
            return False, "Consumidor nao identificado (elegivel para doacao manual)."
        if RE_CPF_MASCARA.search(trecho) or re.search(r"\b\d{11}\b", re.sub(r"\D", " ", trecho)):
            return True, "Consumidor identificado com CPF/documento — nao usar digitacao manual."

    if "consumidor" in texto.lower() and RE_CPF_MASCARA.search(texto):
        # heuristica fraca: evita falso positivo em outras secoes
        idx = texto.lower().find("consumidor")
        janela = texto[idx : idx + 350]
        if RE_CONSUMIDOR_NAO_ID.search(janela):
            return False, "Consumidor nao identificado (elegivel para doacao manual)."
        if RE_CPF_MASCARA.search(janela):
            return True, "Consumidor identificado — nao usar digitacao manual."

    return None, "Nao foi possivel determinar o consumidor na consulta SEFAZ."


def consultar_elegibilidade_cupom(bruto_ou_chave: str) -> ResultadoChaveCupom:
    """Extrai chave, checa QR offline e consulta pagina publica SP quando preciso."""
    bruto = (bruto_ou_chave or "").strip()
    chave = extrair_chave_de_leitura(bruto)
    if not chave:
        return ResultadoChaveCupom(
            chave="",
            qr_bruto=bruto,
            mensagem="Nao foi possivel extrair chave de 44 digitos da leitura.",
        )

    cpf_qr = qr_indica_cpf_destinatario(bruto)
    url = montar_url_consulta_sp(chave, bruto)
    resultado = ResultadoChaveCupom(
        chave=chave,
        qr_bruto=bruto,
        url_consulta=url,
        cpf_no_qr=cpf_qr,
    )

    if cpf_qr:
        resultado.consumidor_identificado = True
        resultado.mensagem = "QR indica destinatario com CPF — nao elegivel para digitacao."
        return resultado

    try:
        html = _baixar_html_consulta(url)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        resultado.mensagem = f"Falha ao consultar SEFAZ: {exc}"
        return resultado

    identificado, msg = analisar_html_consumidor(html)
    resultado.consumidor_identificado = identificado
    resultado.mensagem = msg

    # CNPJ emitente a partir da chave (posicoes 7-20, 1-based → [6:20])
    resultado.cnpj_emitente = chave[6:20]
    # AAMM na chave [2:6]
    aamm = chave[2:6]
    if len(aamm) == 4 and aamm.isdigit():
        resultado.data_emissao = f"20{aamm[0:2]}-{aamm[2:4]}"

    return resultado
