"""Utilitarios do modulo NFP – Creditos (Nota Fiscal Paulista)."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable, Optional

NOME_GENERICO_CONFERIR = "ESTABELECIMENTO DIEGO (Conferir CNPJ)"
NOMES_GENERICOS = {
    "ESTABELECIMENTO DIEGO",
    "ESTABELICIMENTO DIEGO",
    "ESTABELECIMENTO",
    "ESTABELICIMENTO",
    "DIEGO",
    "LOJA",
    NOME_GENERICO_CONFERIR.upper(),
}

CAPTADORES_PADRAO = [
    "SEDE AEB",
    "CEI LIBERDADE",
    "CEI BELÉM",
    "CEI MONTE AZUL",
    "CEI VILA NOVA CACHOEIRINHA",
    "CEI VILA LEOPOLDINA",
    "CEI VILA GUSTAVO",
    "SIAT II ARMÊNIA",
    "CTA 17 – LIBERDADE",
    "CTA 18 – CANINDÉ",
    "CASA PORTO SEGURO",
    "CAE F PAULICEIA",
    "CAE F RIVOLI",
    "CAE F DOWN TOWN",
    "CAE F VICTORY",
    "CAE F SAMARITANO",
    "CA Grants",
    "CAE I CENTRO",
    "CECOM",
    "CENTRO DIA IDOSOS",
    "CRIAR & TOCAR",
    "CEDESP",
    "REPUBLICA RECOMEÇAR",
    "REENCONTRO JABAQUARA",
    "REENCONTRO ANHANGABAÚ",
    "REENCONTRO CRUZEIRO DO SUL",
    "REENCONTRO PARI",
    "DIEGO",
]

# Agentes com rateio padrao historico (50/50). Demais unidades = 0% agente / 100% AEB.
AGENTES_CAPTACAO_PADRAO = ("DIEGO",)
PERCENTUAL_AGENTE_PADRAO_POR_CODIGO = {
    "DIEGO": 50,
}


def percentual_agente_padrao(codigo: Optional[str]) -> int:
    codigo_n = normalizar_agente_captacao(codigo)
    return int(PERCENTUAL_AGENTE_PADRAO_POR_CODIGO.get(codigo_n, 0))


def normalizar_agente_captacao(valor: Optional[str]) -> str:
    return (valor or "").strip().upper()


def origem_rateio_agente(agente: str) -> str:
    return normalizar_agente_captacao(agente)


def origem_doador_auto_agente(agente: str) -> str:
    return f"DOADOR_AUTOMATICO_{normalizar_agente_captacao(agente)}"


def origem_eh_rateio_agente(origem: Optional[str]) -> bool:
    """Origem elegivel a rateio do agente (percentual vem do cadastro)."""
    o = normalizar_agente_captacao(origem)
    if not o or o in {"DIRETO_AEB", "AEB"}:
        return False
    if o.startswith("DOADOR_AUTOMATICO"):
        return False
    return True


def decidir_origem_rateio_credito(
    *,
    captador_cnpj: Optional[str] = None,
    eh_loja_agente: bool = False,
    eh_doacao_automatica: bool = False,
    captador_cpf: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    """
    Define origem e captador efetivo do credito SEFAZ.

    CPF captado por agente tem prioridade: aplica rateio do agente
    (nao zera como doador direto AEB), para qualquer agente com percentual.
    """
    cap_cpf = normalizar_agente_captacao(captador_cpf)
    cap_cnpj = normalizar_agente_captacao(captador_cnpj)

    if cap_cpf:
        return origem_rateio_agente(cap_cpf), cap_cpf
    if eh_loja_agente and eh_doacao_automatica:
        agente = cap_cnpj or "AGENTE"
        return origem_doador_auto_agente(agente), cap_cnpj or None
    if eh_loja_agente and cap_cnpj:
        return origem_rateio_agente(cap_cnpj), cap_cnpj
    if eh_doacao_automatica:
        return "DOADOR_AUTOMATICO_AEB", None
    return "DIRETO_AEB", None


# Compatibilidade com imports antigos.
origem_eh_rateio_50_agente = origem_eh_rateio_agente


def cpf_valido(cpf: str) -> bool:
    c = limpar_documento(cpf)
    if len(c) != 11 or c == c[0] * 11:
        return False
    soma = sum(int(c[i]) * (10 - i) for i in range(9))
    d1 = 11 - (soma % 11)
    d1 = 0 if d1 >= 10 else d1
    soma = sum(int(c[i]) * (11 - i) for i in range(10))
    d2 = 11 - (soma % 11)
    d2 = 0 if d2 >= 10 else d2
    return c.endswith(f"{d1}{d2}")


def rateio_centavos(retorno: int, percentual_agente: int) -> tuple[int, int]:
    """Divide retorno em parte agente / AEB conforme percentual 0-100."""
    retorno = int(retorno or 0)
    pct = max(0, min(100, int(percentual_agente or 0)))
    if pct <= 0:
        return 0, retorno
    if pct >= 100:
        return retorno, 0
    valor_agente = (retorno * pct) // 100
    return valor_agente, retorno - valor_agente


def nome_loja_generico_agente(agente: Optional[str] = None) -> str:
    ag = normalizar_agente_captacao(agente) or "AGENTE"
    return f"ESTABELECIMENTO {ag} (Conferir CNPJ)"


def so_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def limpar_documento(valor) -> str:
    return so_digitos(valor)


def limpar_nota(valor) -> str:
    texto = str(valor or "").strip()
    if not texto or texto.lower() == "nan":
        return ""
    # remove .0 de floats excel
    if re.fullmatch(r"\d+\.0+", texto):
        texto = texto.split(".", 1)[0]
    return texto.strip()


def competencia_valida(valor: Optional[str]) -> bool:
    if not valor:
        return False
    return bool(re.match(r"^\d{4}-\d{2}$", str(valor).strip()))


# Competencia operacional = mes dos registros no site + 4 meses
# (ex.: notas 11/2025 -> competencia 2026-03).
OFFSET_MESES_COMPETENCIA_NFP = 4
TIPO_DOACAO_AUTOMATICA = "DOACAO_AUTOMATICA"


def parse_data_planilha(valor) -> Optional[tuple[int, int, int]]:
    """Extrai (ano, mes, dia) de datas BR/ISO comuns nas exportacoes SEFAZ."""
    if valor is None:
        return None
    if hasattr(valor, "year") and hasattr(valor, "month"):
        try:
            return int(valor.year), int(valor.month), int(getattr(valor, "day", 1) or 1)
        except Exception:
            return None
    raw = str(valor).strip()
    if not raw or raw.lower() == "nan":
        return None
    raw = raw.split(" ")[0].replace(".", "/")
    try:
        if "/" in raw:
            p = raw.split("/")
            if len(p[0]) == 4:
                y, m, d = int(p[0]), int(p[1]), int(p[2]) if len(p) > 2 else 1
            else:
                d, m, y = int(p[0]), int(p[1]), int(p[2])
                if y < 100:
                    y += 2000
            return y, m, d
        if "-" in raw:
            p = raw.split("-")
            y, m = int(p[0]), int(p[1])
            d = int(p[2]) if len(p) > 2 else 1
            return y, m, d
    except Exception:
        return None
    return None


def competencia_de_data_registro(valor, offset_meses: int = OFFSET_MESES_COMPETENCIA_NFP) -> Optional[str]:
    """Converte data do registro na competencia operacional (+offset meses)."""
    parsed = parse_data_planilha(valor)
    if not parsed:
        return None
    y, m, _d = parsed
    if m < 1 or m > 12 or y < 1990:
        return None
    idx = (y * 12 + (m - 1)) + int(offset_meses)
    y2, m2 = divmod(idx, 12)
    return f"{y2:04d}-{m2 + 1:02d}"


def competencia_referencia_das_datas(
    datas: Iterable,
    offset_meses: int = OFFSET_MESES_COMPETENCIA_NFP,
) -> str:
    """Determina a competencia majoritaria a partir das datas dos registros."""
    from collections import Counter

    contagem: Counter[str] = Counter()
    for valor in datas:
        comp = competencia_de_data_registro(valor, offset_meses=offset_meses)
        if comp:
            contagem[comp] += 1
    if not contagem:
        raise ValueError(
            "Nao foi possivel detectar a competencia. "
            "Verifique as datas da planilha (mes dos registros + 4 meses)."
        )
    return contagem.most_common(1)[0][0]


def _normalizar_rotulo_sefaz(valor: Optional[str]) -> str:
    texto = str(valor or "").strip().lower()
    for a, b in (
        ("á", "a"), ("à", "a"), ("ã", "a"), ("â", "a"),
        ("é", "e"), ("ê", "e"), ("í", "i"),
        ("ó", "o"), ("ô", "o"), ("õ", "o"), ("ú", "u"), ("ç", "c"),
    ):
        texto = texto.replace(a, b)
    texto = re.sub(r"\s+", "_", texto)
    return texto.replace("_", "")


def tipo_eh_doacao_automatica(valor: Optional[str]) -> bool:
    return _normalizar_rotulo_sefaz(valor) == "doacaoautomatica"


def situacao_credito_bloqueada(valor: Optional[str]) -> bool:
    """Creditos com situacao Bloqueado nao entram na conta/rateio."""
    return "bloqueado" in _normalizar_rotulo_sefaz(valor)


def valor_para_centavos(valor) -> int:
    if valor is None:
        return 0
    texto = str(valor).strip()
    if not texto or texto.lower() == "nan":
        return 0
    texto = texto.replace("R$", "").replace(" ", "")
    if "," in texto and "." in texto:
        if texto.rfind(",") > texto.rfind("."):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        decimal = Decimal(texto).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return 0
    return int(decimal * 100)


def centavos_para_float(centavos: int) -> float:
    return float(Decimal(int(centavos or 0)) / Decimal(100))


def chave_base(cnpj: str, numero_nota: str, data: str = "") -> str:
    return f"{limpar_documento(cnpj)}|{limpar_nota(numero_nota)}|{str(data or '').strip()}"


def chave_com_ocorrencia(base: str, ocorrencia: int) -> str:
    if int(ocorrencia or 1) <= 1:
        return base
    return f"{base}#{int(ocorrencia)}"


def _calc_dv(base: str, pesos: list[int]) -> int:
    soma = sum(int(d) * p for d, p in zip(base, pesos))
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def cnpj_valido(cnpj: str) -> bool:
    c = limpar_documento(cnpj)
    if len(c) != 14 or c == c[0] * 14:
        return False
    d1 = _calc_dv(c[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    d2 = _calc_dv(c[:12] + str(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return c == c[:12] + f"{d1}{d2}"


def nome_eh_generico(nome: Optional[str]) -> bool:
    n = (nome or "").strip().upper()
    if not n:
        return True
    if n in NOMES_GENERICOS:
        return True
    if "DIEGO" in n and "ESTABE" in n:
        return True
    if "CONFERIR CNPJ" in n:
        return True
    return False


def nome_loja_para_cadastro(cnpj: str, nome_informado: Optional[str]) -> str:
    nome = (nome_informado or "").strip()
    if not cnpj_valido(cnpj):
        return NOME_GENERICO_CONFERIR
    if nome_eh_generico(nome):
        return "ESTABELECIMENTO DIEGO"
    return nome


def normalizar_texto_coluna(valor: str) -> str:
    texto = str(valor or "").strip().lower()
    texto = (
        texto.replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )
    return re.sub(r"\s+", " ", texto)


def achar_coluna(colunas: list[str], candidatos: list[str]) -> Optional[str]:
    mapa = {normalizar_texto_coluna(c): c for c in colunas}
    for cand in candidatos:
        chave = normalizar_texto_coluna(cand)
        if chave in mapa:
            return mapa[chave]
    for cand in candidatos:
        chave = normalizar_texto_coluna(cand)
        for col_norm, col in mapa.items():
            if chave and chave in col_norm:
                return col
    return None
