# -*- coding: utf-8 -*-
"""Vínculo fornecedor ↔ projetos (instituições) e rótulos legados."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional


def _norm(texto: str) -> str:
    bruto = unicodedata.normalize("NFKD", (texto or "").strip().upper())
    return "".join(ch for ch in bruto if not unicodedata.combining(ch))


def _tokens_projetos_legacy(texto: str) -> list[str]:
    if not (texto or "").strip():
        return []
    partes = re.split(r"[;,/|]+", texto)
    return [p.strip() for p in partes if p.strip()]


def token_indica_geral(token: str) -> bool:
    norm = _norm(token)
    return norm in {"GERAL", "TODOS", "TODAS", "ORGANIZACAO", "ORGANIZAÇÃO", "AEB"}


def montar_rotulo_projetos(*, atende_geral: bool, nomes: Iterable[str]) -> str:
    if atende_geral:
        return "GERAL"
    lista = [n.strip() for n in nomes if (n or "").strip()]
    if not lista:
        return ""
    return ", ".join(sorted(set(lista), key=lambda x: x.upper()))


def resolver_instituicao_por_token(
    token: str,
    instituicoes: list[dict],
) -> Optional[str]:
    """Retorna instituicao_id se houver match por nome (parcial ou exato)."""
    alvo = _norm(token)
    if not alvo or token_indica_geral(token):
        return None

    melhor_id: Optional[str] = None
    melhor_score = 0
    for inst in instituicoes:
        nome = _norm(inst.get("nome") or "")
        if not nome:
            continue
        if alvo == nome:
            return inst["id"]
        if alvo in nome or nome in alvo:
            score = min(len(alvo), len(nome))
            if score > melhor_score:
                melhor_score = score
                melhor_id = inst["id"]
    return melhor_id


def parsear_projetos_legacy(
    texto: Optional[str],
    instituicoes: list[dict],
) -> tuple[bool, list[str]]:
    """Interpreta texto legado da planilha → (atende_geral, instituicao_ids)."""
    bruto = (texto or "").strip()
    if not bruto:
        return True, []
    if token_indica_geral(bruto):
        return True, []

    ids: list[str] = []
    visto: set[str] = set()
    algum_geral = False
    for token in _tokens_projetos_legacy(bruto):
        if token_indica_geral(token):
            algum_geral = True
            continue
        inst_id = resolver_instituicao_por_token(token, instituicoes)
        if inst_id and inst_id not in visto:
            visto.add(inst_id)
            ids.append(inst_id)

    if algum_geral and not ids:
        return True, []
    if ids:
        return False, ids
    return False, []
