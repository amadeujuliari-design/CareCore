"""Utilitarios de leitura de cupom NFC-e / chave de acesso NFP."""

from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, timedelta
from html import unescape
from typing import Optional

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


# Folga na leitura CareCore vs prazo estrito SEFAZ (dia 20 do mes subsequente).
FOLGA_DIAS_PRAZO_LEITURA_NFP = 1


def parse_ano_mes_emissao_ref(data_emissao_ref: Optional[str]) -> Optional[tuple[int, int]]:
    """Aceita AAAA-MM (ref da chave NFP)."""
    ref = (data_emissao_ref or "").strip()
    if len(ref) < 7 or ref[4] != "-":
        return None
    try:
        ano = int(ref[0:4])
        mes = int(ref[5:7])
    except ValueError:
        return None
    if ano < 2000 or mes < 1 or mes > 12:
        return None
    return ano, mes


def data_limite_cadastro_sefaz(ano: int, mes: int) -> date:
    """Ultimo dia em que a SEFAZ aceita cadastro: dia 20 do mes subsequente a emissao."""
    if mes == 12:
        return date(ano + 1, 1, 20)
    return date(ano, mes + 1, 20)


def data_limite_leitura_carecore(
    ano: int,
    mes: int,
    *,
    folga_dias: int = FOLGA_DIAS_PRAZO_LEITURA_NFP,
) -> date:
    """Limite operacional na leitura: prazo SEFAZ + folga (padrao 1 dia)."""
    return data_limite_cadastro_sefaz(ano, mes) + timedelta(days=max(0, int(folga_dias)))


def cupom_fora_prazo_leitura(
    data_emissao_ref: Optional[str],
    *,
    hoje: Optional[date] = None,
    folga_dias: int = FOLGA_DIAS_PRAZO_LEITURA_NFP,
) -> bool:
    """True se a ref AAAA-MM ja passou do limite de leitura (com folga)."""
    ym = parse_ano_mes_emissao_ref(data_emissao_ref)
    if not ym:
        return False
    ano, mes = ym
    if hoje is None:
        try:
            from time_operacional import agora_operacional_naive

            dia = agora_operacional_naive().date()
        except Exception:
            dia = date.today()
    else:
        dia = hoje
    return dia > data_limite_leitura_carecore(ano, mes, folga_dias=folga_dias)


def mensagem_rejeicao_prazo(data_emissao_ref: Optional[str]) -> str:
    ym = parse_ano_mes_emissao_ref(data_emissao_ref)
    if not ym:
        return (
            "Cupom fora do prazo de cadastro NFP (SEFAZ: ate o dia 20 do mes "
            "subsequente; CareCore leitura com folga de 1 dia)."
        )
    ano, mes = ym
    lim_sefaz = data_limite_cadastro_sefaz(ano, mes)
    lim_leitura = data_limite_leitura_carecore(ano, mes)
    return (
        f"Fora do prazo NFP (emissao {ano:04d}-{mes:02d}). "
        f"SEFAZ ate {lim_sefaz.isoformat()}; "
        f"leitura CareCore ate {lim_leitura.isoformat()} (folga 1 dia)."
    )
