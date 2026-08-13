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
# Leitores USB às vezes engolem /, ? e //: https:www...qrcodep=CHAVE|...
RE_P_CHAVE = re.compile(r"(?:[?&/]|^|[^=])p=(\d{44})", re.I)
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
    data_emissao: str | None = None  # AAAA-MM-DD quando o dia for conhecido
    data_emissao_ref: str | None = None  # AAAA-MM da chave
    uf_ibge: str | None = None
    modelo: str | None = None
    serie: str | None = None
    numero_nf: str | None = None
    tipo_emissao: str | None = None
    qr_versao: str | None = None
    tp_ambiente: str | None = None
    tp_id_dest: str | None = None


def _chave_de_param_p(parte: str) -> str | None:
    bruto = urllib.parse.unquote(parte or "")
    primeiro = bruto.split("|")[0]
    digitos = re.sub(r"\D", "", primeiro)
    if len(digitos) >= 44:
        return digitos[:44]
    return None


def extrair_chave_de_leitura(bruto: str) -> str | None:
    """Extrai chave de 44 digitos de QR (URL) ou digitacao.

    Aceita URL SEFAZ normal e leitura de pistola que remove /, ? e //.
    """
    texto = (bruto or "").strip()
    if not texto:
        return None

    # Mais robusto: p= seguido imediatamente de 44 digitos (URL mangled ou ok).
    m_direto = RE_P_CHAVE.search(texto)
    if m_direto:
        return m_direto.group(1)

    # URL com p=chave|...
    try:
        parsed = urllib.parse.urlparse(texto)
        qs = urllib.parse.parse_qs(parsed.query)
        if "p" in qs and qs["p"]:
            achou = _chave_de_param_p(qs["p"][0])
            if achou:
                return achou
    except Exception:
        pass

    # p= embutido (com ou sem ?/&) — ex.: ...qrcodep=CHAVE|2|1
    m_p = re.search(r"p=([^&\s]+)", texto, re.I)
    if m_p:
        achou = _chave_de_param_p(m_p.group(1))
        if achou:
            return achou

    digitos = re.sub(r"\D", "", texto)
    if len(digitos) == 44:
        return digitos
    # Sequencia longa (URL mangled sem separadores): chave NFe costuma comecar em pos 0 apos p=
    m = RE_CHAVE.search(texto)
    if m:
        return m.group(1)
    # Fallback: primeiros 44 digitos se parecer chave SP (UF 35) embutida
    if len(digitos) > 44:
        for i in range(0, len(digitos) - 43):
            cand = digitos[i : i + 44]
            if cand.startswith("35"):
                return cand
    return None


def _centavos_de_texto(txt: str) -> int | None:
    bruto = (txt or "").strip()
    if not bruto:
        return None
    if re.match(r"^\d{1,3}(\.\d{3})*,\d{2}$", bruto):
        normal = bruto.replace(".", "").replace(",", ".")
    else:
        normal = bruto.replace(",", ".")
    try:
        return int(round(float(normal) * 100))
    except ValueError:
        return None


def parsear_chave_nfe(chave: str) -> dict[str, Optional[str]]:
    """Campos estruturais da chave de acesso (44 digitos)."""
    digitos = re.sub(r"\D", "", chave or "")
    if len(digitos) != 44:
        return {}
    aamm = digitos[2:6]
    data_ref = None
    if aamm.isdigit():
        data_ref = f"20{aamm[0:2]}-{aamm[2:4]}"
    return {
        "chave": digitos,
        "uf_ibge": digitos[0:2],
        "data_emissao_ref": data_ref,
        "cnpj_emitente": digitos[6:20],
        "modelo": digitos[20:22],
        "serie": digitos[22:25],
        "numero_nf": digitos[25:34],
        "tipo_emissao": digitos[34:35],
    }


def _partes_parametro_p(bruto: str) -> list[str]:
    texto = (bruto or "").strip()
    m_p = re.search(r"p=([^&\s]+)", texto, re.I)
    raw = urllib.parse.unquote(m_p.group(1)) if m_p else texto
    return [p.strip() for p in raw.split("|") if p.strip() != ""]


def parsear_parametros_qr(bruto: str) -> dict[str, object]:
    """Extrai versao, ambiente, valor, dia e destinatario do parametro p= do QR."""
    partes = _partes_parametro_p(bruto)
    if len(partes) < 2:
        return {}
    out: dict[str, object] = {}
    if len(partes) >= 2 and re.fullmatch(r"\d{1,2}", partes[1] or ""):
        out["qr_versao"] = partes[1]
    if len(partes) >= 3 and re.fullmatch(r"\d", partes[2] or ""):
        out["tp_ambiente"] = partes[2]

    for i, parte in enumerate(partes):
        if parte.strip() in {"1", "2", "3"} and i + 1 < len(partes):
            doc = re.sub(r"\D", "", partes[i + 1])
            if (parte.strip() == "2" and len(doc) == 11) or (
                parte.strip() == "1" and len(doc) == 14
            ):
                out["tp_id_dest"] = parte.strip()
                break

    for parte in partes[3:]:
        if re.fullmatch(r"\d{1,10}[.,]\d{2}", parte):
            centavos = _centavos_de_texto(parte)
            if centavos is not None:
                out["valor_centavos"] = centavos
            break

    # Layout offline: chave|versao|amb|dia|valor|tpIdDest|dest|hash
    if (
        len(partes) >= 5
        and re.fullmatch(r"\d{1,2}", partes[3] or "")
        and re.fullmatch(r"\d{1,10}[.,]\d{2}", partes[4] or "")
    ):
        n_dia = int(partes[3])
        if 1 <= n_dia <= 31:
            out["dia_emissao"] = n_dia
    return out


def parsear_leitura_cupom(bruto: str, chave: Optional[str] = None) -> dict[str, object]:
    """Junta chave NFe + parametros do QR (tudo que a leitura local consegue)."""
    chave_n = chave or extrair_chave_de_leitura(bruto) or ""
    meta: dict[str, object] = {}
    meta.update(parsear_chave_nfe(chave_n))
    qr = parsear_parametros_qr(bruto)
    dia = qr.pop("dia_emissao", None)
    meta.update(qr)
    ref = str(meta.get("data_emissao_ref") or "")
    if dia and len(ref) == 7:
        meta["data_emissao"] = f"{ref}-{int(dia):02d}"
    if chave_n:
        meta["url_consulta"] = montar_url_consulta_sp(chave_n, bruto or "")
    return meta


def qr_indica_cpf_destinatario(bruto: str) -> bool:
    """NFC-e offline (v2/v3): parametros 6/7 do p= podem trazer tipo CPF + numero."""
    texto = (bruto or "").strip()
    m_p = re.search(r"p=([^&\s]+)", texto, re.I)
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


def _url_http_valida(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def montar_url_consulta_sp(chave: str, qr_bruto: str = "") -> str:
    """Monta URL de consulta publica. Ignora QR mangled da pistola (sem host)."""
    bruto = (qr_bruto or "").strip()
    if (
        "nfce.fazenda.sp.gov.br" in bruto.lower()
        and "p=" in bruto.lower()
        and bruto.lower().startswith("http")
        and _url_http_valida(bruto)
    ):
        return bruto
    # | precisa ser %7C em alguns ambientes urllib/Python.
    param = urllib.parse.quote(f"{chave}|3|1", safe="")
    return f"{URL_CONSULTA_SP}?p={param}"


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


def analisar_html_complementos(html: str) -> dict[str, object]:
    """Valor e data de emissao quando a pagina publica da SEFAZ traz esses campos."""
    texto = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    texto = re.sub(r"\s+", " ", texto)
    out: dict[str, object] = {}
    m_val = re.search(
        r"valor\s*(?:total|da\s*nfc-?e|a\s*pagar)?[^0-9]{0,40}"
        r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})",
        texto,
        re.I,
    )
    if m_val:
        centavos = _centavos_de_texto(m_val.group(1))
        if centavos is not None:
            out["valor_centavos"] = centavos
    m_dt = re.search(
        r"emiss[aã]o[^0-9]{0,40}(\d{2}/\d{2}/\d{4})",
        texto,
        re.I,
    )
    if m_dt:
        dia, mes, ano = m_dt.group(1).split("/")
        out["data_emissao"] = f"{ano}-{mes}-{dia}"
    return out


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
    meta = parsear_leitura_cupom(bruto, chave)
    url = str(meta.get("url_consulta") or montar_url_consulta_sp(chave, bruto))
    resultado = ResultadoChaveCupom(
        chave=chave,
        qr_bruto=bruto,
        url_consulta=url,
        cpf_no_qr=cpf_qr,
        cnpj_emitente=str(meta["cnpj_emitente"]) if meta.get("cnpj_emitente") else None,
        valor_centavos=meta.get("valor_centavos") if isinstance(meta.get("valor_centavos"), int) else None,
        data_emissao=str(meta["data_emissao"]) if meta.get("data_emissao") else None,
        data_emissao_ref=str(meta["data_emissao_ref"]) if meta.get("data_emissao_ref") else None,
        uf_ibge=str(meta["uf_ibge"]) if meta.get("uf_ibge") else None,
        modelo=str(meta["modelo"]) if meta.get("modelo") else None,
        serie=str(meta["serie"]) if meta.get("serie") else None,
        numero_nf=str(meta["numero_nf"]) if meta.get("numero_nf") else None,
        tipo_emissao=str(meta["tipo_emissao"]) if meta.get("tipo_emissao") else None,
        qr_versao=str(meta["qr_versao"]) if meta.get("qr_versao") else None,
        tp_ambiente=str(meta["tp_ambiente"]) if meta.get("tp_ambiente") else None,
        tp_id_dest=str(meta["tp_id_dest"]) if meta.get("tp_id_dest") else None,
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
    extra = analisar_html_complementos(html)
    if resultado.valor_centavos is None and isinstance(extra.get("valor_centavos"), int):
        resultado.valor_centavos = extra["valor_centavos"]  # type: ignore[assignment]
    if extra.get("data_emissao"):
        resultado.data_emissao = str(extra["data_emissao"])

    return resultado


# Folga na leitura CareCore vs prazo estrito SEFAZ
# (dia 20 do 2o mes apos a emissao: retrasado + passado ate o dia 20 vigente).
FOLGA_DIAS_PRAZO_LEITURA_NFP = 1
MESES_JANELA_CADASTRO_NFP = 2


def _somar_meses(ano: int, mes: int, delta: int) -> tuple[int, int]:
    total = ano * 12 + (mes - 1) + int(delta)
    return total // 12, (total % 12) + 1


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
    """Ultimo dia em que a SEFAZ aceita cadastro.

    Janela: cupons do mes retrasado e do mes passado ate o dia 20 do mes vigente
    = dia 20 dois meses apos a emissao (ex.: junho -> 20/08).
    """
    ano_lim, mes_lim = _somar_meses(ano, mes, MESES_JANELA_CADASTRO_NFP)
    return date(ano_lim, mes_lim, 20)


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
            "Cupom fora do prazo de cadastro NFP (SEFAZ: mes retrasado e passado "
            "ate o dia 20 do mes vigente; CareCore leitura com folga de 1 dia)."
        )
    ano, mes = ym
    lim_sefaz = data_limite_cadastro_sefaz(ano, mes)
    lim_leitura = data_limite_leitura_carecore(ano, mes)
    return (
        f"Fora do prazo NFP (emissao {ano:04d}-{mes:02d}). "
        f"SEFAZ ate {lim_sefaz.isoformat()} (2 meses); "
        f"leitura CareCore ate {lim_leitura.isoformat()} (folga 1 dia)."
    )
