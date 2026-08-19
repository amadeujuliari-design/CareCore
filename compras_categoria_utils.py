"""Nome de categoria/fonte: reuso do cadastro existente, sem semelhantes."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional

_STOP = frozenset({"E", "DE", "DA", "DO", "DAS", "DOS", "COM", "PARA", "A", "O", "AS", "OS"})


def _sem_acento(texto: str) -> str:
    nfd = unicodedata.normalize("NFD", texto or "")
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def tokens_nome_cadastro(nome: str) -> frozenset[str]:
    t = re.sub(r"[^A-Z0-9]+", " ", _sem_acento(nome).upper())
    return frozenset(tok for tok in t.split() if tok and tok not in _STOP)


def _tokens_compativeis(a: str, b: str) -> bool:
    if a == b:
        return True
    menor, maior = (a, b) if len(a) <= len(b) else (b, a)
    return len(menor) >= 3 and maior.startswith(menor)


def _conjunto_coberto(menor: frozenset[str], maior: frozenset[str]) -> bool:
    if not menor or not maior:
        return False
    usados: set[str] = set()
    for tok in menor:
        achou = False
        for cand in maior:
            if cand in usados:
                continue
            if _tokens_compativeis(tok, cand):
                usados.add(cand)
                achou = True
                break
        if not achou:
            return False
    return True


def nomes_sao_semelhantes(a: str, b: str) -> bool:
    ta, tb = tokens_nome_cadastro(a), tokens_nome_cadastro(b)
    if not ta or not tb:
        return False
    if ta == tb:
        return True
    return _conjunto_coberto(ta, tb) or _conjunto_coberto(tb, ta)


def nomes_cadastro_semelhantes(
    nome: str,
    existentes: Iterable[str],
    *,
    ignorar: Optional[str] = None,
) -> list[str]:
    alvo = (nome or "").strip()
    if not alvo:
        return []
    ignorar_norm = (ignorar or "").strip().lower()
    saida: list[str] = []
    vistos: set[str] = set()
    for bruto in existentes:
        atual = (bruto or "").strip()
        if not atual:
            continue
        chave = atual.lower()
        if chave == ignorar_norm or chave == alvo.lower() or chave in vistos:
            continue
        if nomes_sao_semelhantes(alvo, atual):
            vistos.add(chave)
            saida.append(atual)
    return saida


def nome_cadastro_exato(nome: str, existentes: Iterable[str]) -> Optional[str]:
    alvo = (nome or "").strip().lower()
    if not alvo:
        return None
    for bruto in existentes:
        atual = (bruto or "").strip()
        if atual.lower() == alvo:
            return atual
    return None


def resolver_nome_cadastro(nome: str, existentes: Iterable[str]) -> Optional[str]:
    """Reusa o nome já cadastrado (exato ou um único semelhante). Não inventa paralelo."""
    lista = [(item or "").strip() for item in existentes if (item or "").strip()]
    exato = nome_cadastro_exato(nome, lista)
    if exato:
        return exato
    semelhantes = nomes_cadastro_semelhantes(nome, lista)
    if len(semelhantes) == 1:
        return semelhantes[0]
    iguais = [item for item in semelhantes if tokens_nome_cadastro(item) == tokens_nome_cadastro(nome)]
    if len(iguais) == 1:
        return iguais[0]
    return None


def mensagem_nome_semelhante(*, tipo: str, semelhantes: list[str]) -> str:
    if len(semelhantes) == 1:
        return (
            f'Já existe {tipo} semelhante: "{semelhantes[0]}". '
            "Use a existente para não duplicar."
        )
    lista = ", ".join(f'"{item}"' for item in semelhantes)
    return f"Já existem {tipo}s semelhantes: {lista}. Use uma das existentes para não duplicar."
