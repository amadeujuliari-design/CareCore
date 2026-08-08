"""Metas NFP — rateio mensal por projeto (mapa canônico: planilha JULHO 2026)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

# Na planilha METAS NFP, pagamento costuma liberar ~4 meses apos a competencia SEFAZ
# (ex.: MAIO 2026 - REF JANEIRO 2026; JULHO 2026 - REF MARCO).
MESES_ATRAS_REF_CREDITO_PADRAO = 4

# Ordem e nomes exatamente como na aba JULHO 2026 (sem DIEGO — Diego é bloco à parte).
PROJETOS_METAS_NFP = [
    "SEDE",
    "CEI LIBERDADE",
    "CEI BELÉM",
    "CEI MONTE AZUL",
    "CEI VILA NOVA CACHOEIRINHA",
    "CEI VILA LEOPOLDINA",
    "CEI VILA GUSTAVO",
    "SIAT II ARMÊNIA",
    "CTA 17 - LIBERDADE",
    "CTA 18 - CANINDÉ",
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
]

# Aliases para casar unidade_captador / agentes com a linha de metas.
ALIASES_PROJETO_METAS = {
    "SEDE AEB": "SEDE",
    "SEDE": "SEDE",
    "CTA 17 – LIBERDADE": "CTA 17 - LIBERDADE",
    "CTA 18 – CANINDÉ": "CTA 18 - CANINDÉ",
    "CEI BELEM": "CEI BELÉM",
    "CEI BELÉM": "CEI BELÉM",
    "SIAT II ARMENIA": "SIAT II ARMÊNIA",
    "SIAT II ARMÊNIA": "SIAT II ARMÊNIA",
    "REENCONTRO ANHANGABAU": "REENCONTRO ANHANGABAÚ",
    "REENCONTRO ANHANGABAÚ": "REENCONTRO ANHANGABAÚ",
    "REPUBLICA RECOMECAR": "REPUBLICA RECOMEÇAR",
    "REPUBLICA RECOMEÇAR": "REPUBLICA RECOMEÇAR",
    "CAE F PAULICEIA ": "CAE F PAULICEIA",
    "CEDESP ": "CEDESP",
}


def _norm(texto: Optional[str]) -> str:
    t = (texto or "").strip().upper()
    # normaliza hifen tipografico
    t = t.replace("–", "-").replace("—", "-")
    while "  " in t:
        t = t.replace("  ", " ")
    return t


def codigo_projeto_metas(valor: Optional[str]) -> str:
    """Normaliza nome livre (doador/agente) para codigo da linha de metas."""
    n = _norm(valor)
    if not n:
        return ""
    if n in {_norm(p) for p in PROJETOS_METAS_NFP}:
        for p in PROJETOS_METAS_NFP:
            if _norm(p) == n:
                return p
    for alias, dest in ALIASES_PROJETO_METAS.items():
        if _norm(alias) == n:
            return dest
    # match parcial: "SEDE AEB" → SEDE
    if n.startswith("SEDE"):
        return "SEDE"
    for p in PROJETOS_METAS_NFP:
        if _norm(p) == n or n.startswith(_norm(p)) or _norm(p).startswith(n):
            return p
    return ""


@dataclass
class LinhaMetasCalc:
    codigo_projeto: str
    ordem: int
    digitadas: int
    pct_digitadas: float
    doadas: int
    pct_doadas: float
    valor_digitado: float
    valor_aplicativo: float
    valor_total: float
    soulcial: float
    soulcial_campanhas: float
    diego: float
    total: float


@dataclass
class ResumoMetasCalc:
    f35_digitado: float
    g35_fundo: float
    h35_projetos: float
    f36_doado: float
    g36_fundo: float
    h36_projetos: float
    f37_total: float
    g37_fundo: float
    h37_projetos: float
    soulcial_base: float
    soulcial_20: float
    fundo_10: float
    premiacao_10: float
    soulcial_rateio: float
    total_captador: float
    valor_diego: float
    total_geral_aeb: float
    total_rateio_geral: float
    # Batimento planilha: entradas (conquistado) vs saidas (aplicado Excel = rateio+fundo+linhas+Diego).
    valor_conquistado: float
    valor_aplicado: float
    batimento_diferenca: float
    batimento_ok: bool
    digitadas_diego: int
    digitadas_projetos: int
    digitadas_geral: int
    linhas: list[LinhaMetasCalc]


def calcular_metas_julho(
    *,
    digitadas_por_projeto: dict[str, int],
    doadas_por_projeto: dict[str, int],
    soulcial_por_projeto: dict[str, float],
    campanhas_por_projeto: dict[str, float],
    f35_digitado: float,
    f36_doado: float,
    soulcial_base: float,
    total_captador: float,
    digitadas_diego: int = 0,
    pct_fundo: float = 0.30,
    pct_soulcial: float = 0.20,
    pct_fundo_soulcial: float = 0.10,
    pct_premiacao: float = 0.10,
    pct_diego: float = 0.50,
) -> ResumoMetasCalc:
    """
    Replica as formulas da aba JULHO 2026.
    Campos manuais (Digitado no TXT): digitadas, soulcial, campanhas, f35, f36,
    soulcial_base (B42), total_captador (J42), digitadas_diego (B31).
    """
    f35 = float(f35_digitado or 0)
    f36 = float(f36_doado or 0)
    g35 = f35 * pct_fundo
    g36 = f36 * pct_fundo
    h35 = f35 - g35
    h36 = f36 - g36
    f37 = f35 + f36
    g37 = g35 + g36
    h37 = h35 + h36

    soma_b = sum(int(digitadas_por_projeto.get(p, 0) or 0) for p in PROJETOS_METAS_NFP)
    soma_d = sum(int(doadas_por_projeto.get(p, 0) or 0) for p in PROJETOS_METAS_NFP)

    base_s = float(soulcial_base or 0)
    tot_cap = float(total_captador or 0)
    s20 = base_s * pct_soulcial
    f10 = base_s * pct_fundo_soulcial
    p10 = base_s * pct_premiacao
    rateio_s = s20 + f10 + p10
    valor_diego = tot_cap * pct_diego

    linhas: list[LinhaMetasCalc] = []
    soma_l = 0.0
    for i, projeto in enumerate(PROJETOS_METAS_NFP):
        b = int(digitadas_por_projeto.get(projeto, 0) or 0)
        d = int(doadas_por_projeto.get(projeto, 0) or 0)
        c = (b / soma_b) if soma_b else 0.0
        e = (d / soma_d) if soma_d else 0.0
        f = h35 * c
        g = h36 * e
        h = f + g
        soul = float(soulcial_por_projeto.get(projeto, 0) or 0)
        camp = float(campanhas_por_projeto.get(projeto, 0) or 0)
        # Na planilha, so SEDE recebe a coluna DIEGO (=K42)
        diego = valor_diego if projeto == "SEDE" else 0.0
        total = h + soul + camp + diego
        soma_l += total
        linhas.append(
            LinhaMetasCalc(
                codigo_projeto=projeto,
                ordem=i + 1,
                digitadas=b,
                pct_digitadas=c,
                doadas=d,
                pct_doadas=e,
                valor_digitado=round(f, 2),
                valor_aplicativo=round(g, 2),
                valor_total=round(h, 2),
                soulcial=round(soul, 2),
                soulcial_campanhas=round(camp, 2),
                diego=round(diego, 2),
                total=round(total, 2),
            )
        )

    dig_diego = int(digitadas_diego or 0)
    # Entradas brutas (TOTAL GERAL da planilha): Soulcial + NF + captador.
    valor_conquistado = round(base_s + f37 + tot_cap, 2)
    # Saidas no batimento Excel: G42 + G37 + L30 + K42 (Diego entra na grade e de novo no rodape
    # para fechar o captador bruto). total_rateio_geral CareCore nao duplica Diego.
    valor_aplicado = round(rateio_s + g37 + soma_l + valor_diego, 2)
    batimento_diferenca = round(valor_conquistado - valor_aplicado, 2)
    batimento_ok = abs(batimento_diferenca) <= 0.05

    return ResumoMetasCalc(
        f35_digitado=round(f35, 2),
        g35_fundo=round(g35, 2),
        h35_projetos=round(h35, 2),
        f36_doado=round(f36, 2),
        g36_fundo=round(g36, 2),
        h36_projetos=round(h36, 2),
        f37_total=round(f37, 2),
        g37_fundo=round(g37, 2),
        h37_projetos=round(h37, 2),
        soulcial_base=round(base_s, 2),
        soulcial_20=round(s20, 2),
        fundo_10=round(f10, 2),
        premiacao_10=round(p10, 2),
        soulcial_rateio=round(rateio_s, 2),
        total_captador=round(tot_cap, 2),
        valor_diego=round(valor_diego, 2),
        total_geral_aeb=valor_conquistado,
        total_rateio_geral=round(rateio_s + g37 + soma_l, 2),
        valor_conquistado=valor_conquistado,
        valor_aplicado=valor_aplicado,
        batimento_diferenca=batimento_diferenca,
        batimento_ok=batimento_ok,
        digitadas_diego=dig_diego,
        digitadas_projetos=soma_b,
        digitadas_geral=soma_b + dig_diego,
        linhas=linhas,
    )


def projetos_padrao() -> list[str]:
    return list(PROJETOS_METAS_NFP)


def ref_credito_padrao(
    competencia: str,
    meses_atras: int = MESES_ATRAS_REF_CREDITO_PADRAO,
) -> str:
    """
    Ref. credito SEFAZ sugerida a partir da competencia de pagamento.
    Ex.: 2026-05 → 2026-01; 2026-03 → 2025-11.
    """
    comp = (competencia or "").strip()
    if len(comp) != 7 or comp[4] != "-":
        raise ValueError("Competencia deve ser AAAA-MM.")
    ano = int(comp[:4])
    mes = int(comp[5:7])
    if mes < 1 or mes > 12:
        raise ValueError("Mes da competencia invalido.")
    # recua N meses
    idx = ano * 12 + (mes - 1) - int(meses_atras)
    ano_ref = idx // 12
    mes_ref = (idx % 12) + 1
    return f"{ano_ref:04d}-{mes_ref:02d}"


def somar_linhas_campo(linhas: Iterable[LinhaMetasCalc], campo: str) -> float:
    return round(sum(float(getattr(l, campo) or 0) for l in linhas), 2)
