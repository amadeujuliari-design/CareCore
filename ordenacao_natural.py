"""Ordenação alfanumérica (natural sort) para nomes de quartos e leitos."""
from __future__ import annotations

import re
from typing import Any

_PARTE_NUMERO = re.compile(r"(\d+)")


def normalizar_texto_ordenacao(valor: Any) -> str:
    texto = str(valor or "").strip().casefold()
    texto = re.sub(r"\s*-\s*", " - ", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def chave_ordenacao_natural(valor: Any) -> list[tuple[int, int | str]]:
    texto = normalizar_texto_ordenacao(valor)
    if not texto:
        return [(1, "")]

    chave: list[tuple[int, int | str]] = []
    for parte in _PARTE_NUMERO.split(texto):
        if not parte:
            continue
        if parte.isdigit():
            chave.append((0, int(parte)))
        else:
            chave.append((1, parte))
    return chave
