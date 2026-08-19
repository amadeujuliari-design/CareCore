# -*- coding: utf-8 -*-
"""Nomes canônicos de unidades AEB (NFP / Compras / CareCore)."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from nfp_metas_utils import ALIASES_PROJETO_METAS, PROJETOS_METAS_NFP, codigo_projeto_metas
from nfp_utils import CAPTADORES_PADRAO, normalizar_agente_captacao

CNPJ_MATRIZ_AEB = "61705877000172"

# Aba da planilha Compras → nome fantasia institucional (preferência NFP quando existir).
MAPA_ABA_COMPRAS_NOME: dict[str, str] = {
    "CAEF - DOWN TOWN": "CAE F DOWN TOWN",
    "CAEF - DOWN TOWN ": "CAE F DOWN TOWN",
    "SEDE": "SEDE AEB",
    "CASA PORTO": "CASA PORTO SEGURO",
    "SIAT IIATENDE 3": "SIAT II ARMÊNIA",
    "CDI - ARTE DE VIVER": "CDI - ARTE DE VIVER",
    "CEDESP": "CEDESP",
    "CECOMSMADS": "CECOM",
    "CAEI - IDOSOS": "CAE I CENTRO",
    "CRIAR E TOCAR": "CRIAR & TOCAR",
    "CAEF - RIVOLI": "CAE F RIVOLI",
    "CAEF - RIVOLI ": "CAE F RIVOLI",
    "CTA CANINDE": "CTA 18 – CANINDÉ",
    "CAEF - VICTORY": "CAE F VICTORY",
    "CTA LIBERDADE": "CTA 17 – LIBERDADE",
    "CAEF - LAR SAMARITANO": "CAE F SAMARITANO",
    "CAEF HOTEL PAULICEIA": "CAE F PAULICEIA",
    "GRANTS": "CA Grants",
    "RECOMEÇAR": "REPUBLICA RECOMEÇAR",
    "RECOMEÇAR": "REPUBLICA RECOMEÇAR",
    "PARI": "REENCONTRO PARI",
    "ANHANGABAU": "REENCONTRO ANHANGABAÚ",
    "ANHANGABAU ": "REENCONTRO ANHANGABAÚ",
    "JABAQUARA": "REENCONTRO JABAQUARA",
    "CRUZEIRO": "REENCONTRO CRUZEIRO DO SUL",
    "CEI BELEM": "CEI BELÉM",
    "CEI VILA LEOPOLDINA": "CEI VILA LEOPOLDINA",
    "CEI VNC": "CEI VILA NOVA CACHOEIRINHA",
    "CEI VILA GUSTAVO": "CEI VILA GUSTAVO",
    "CEI LIBERDADE": "CEI LIBERDADE",
    "MONTE AZUL": "CEI MONTE AZUL",
}

# Texto livre / abreviações → rotulo NFP padrão.
ALIASES_ROTULO_NFP: dict[str, str] = {
    "CTA CANINDE": "CTA 18 – CANINDÉ",
    "CTA LIBERDADE": "CTA 17 – LIBERDADE",
    "CASA PORTO": "CASA PORTO SEGURO",
    "SIAT II": "SIAT II ARMÊNIA",
    "CEI BELEM": "CEI BELÉM",
    "CEI VNC": "CEI VILA NOVA CACHOEIRINHA",
    "GRANTS": "CA Grants",
    "CECOMSMADS": "CECOM",
    "CAEI - IDOSOS": "CAE I CENTRO",
    "RECOMEÇAR": "REPUBLICA RECOMEÇAR",
    "RECOMEÇAR": "REPUBLICA RECOMEÇAR",
}


def _norm_chave(texto: Optional[str]) -> str:
    bruto = unicodedata.normalize("NFKD", (texto or "").strip().upper())
    bruto = "".join(ch for ch in bruto if not unicodedata.combining(ch))
    bruto = bruto.replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", bruto).strip()


def limpar_cnpj(valor: Optional[str]) -> Optional[str]:
    digitos = re.sub(r"\D", "", valor or "")
    return digitos if len(digitos) == 14 else None


def usa_cnpj_matriz(cnpj: Optional[str]) -> bool:
    limpo = limpar_cnpj(cnpj)
    return bool(limpo and limpo == CNPJ_MATRIZ_AEB)


def rotulo_nfp_canonico(nome_fantasia: Optional[str]) -> str:
    """Rotulo de captador/agente NFP alinhado à lista padrão."""
    nome = (nome_fantasia or "").strip()
    if not nome:
        return ""
    chave = _norm_chave(nome)
    for alias, dest in ALIASES_ROTULO_NFP.items():
        if _norm_chave(alias) == chave:
            return dest
    codigo = codigo_projeto_metas(nome)
    if codigo == "SEDE":
        return "SEDE AEB"
    alvo = _norm_chave(codigo or nome)
    for item in CAPTADORES_PADRAO:
        if _norm_chave(item) == alvo:
            return item
    for alias, dest in ALIASES_PROJETO_METAS.items():
        if _norm_chave(alias) == alvo or _norm_chave(dest) == alvo:
            for item in CAPTADORES_PADRAO:
                if _norm_chave(item) == _norm_chave(dest):
                    return item
            return dest
    for item in PROJETOS_METAS_NFP:
        if _norm_chave(item) == alvo:
            for cap in CAPTADORES_PADRAO:
                if _norm_chave(cap) == alvo or _norm_chave(codigo_projeto_metas(cap)) == _norm_chave(item):
                    return cap
            return item
    return nome


def nome_fantasia_de_aba(aba: str, titulo_celula: Optional[str] = None) -> str:
    aba_l = (aba or "").strip()
    if aba_l in MAPA_ABA_COMPRAS_NOME:
        return MAPA_ABA_COMPRAS_NOME[aba_l]
    chave_aba = _norm_chave(aba_l)
    for k, v in MAPA_ABA_COMPRAS_NOME.items():
        if _norm_chave(k) == chave_aba:
            return v
    candidato = (titulo_celula or aba_l).strip()
    codigo = codigo_projeto_metas(candidato)
    if codigo:
        if codigo == "SEDE":
            return "SEDE AEB"
        for cap in CAPTADORES_PADRAO:
            if _norm_chave(codigo_projeto_metas(cap)) == _norm_chave(codigo):
                return cap
        return codigo
    return candidato


def chave_unidade(nome_fantasia: str) -> str:
    return normalizar_agente_captacao(rotulo_nfp_canonico(nome_fantasia) or nome_fantasia)
