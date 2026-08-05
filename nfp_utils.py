"""Utilitarios do modulo NFP – Creditos (Nota Fiscal Paulista)."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional

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
