# -*- coding: utf-8 -*-
"""Normalização de telefones do módulo Compras (SP / DDD 11 padrão)."""

from __future__ import annotations

import re
from typing import Optional

DDD_PADRAO_COMPRAS = "11"
_DDD_VALIDOS = frozenset(
    str(d) for d in range(11, 100) if d not in {20, 23, 25, 26, 29, 36, 39, 40, 50, 52, 56, 57, 58, 59, 70, 90}
)
# Simplificado: aceitar 11-99 exceto códigos não alocados comuns; foco SP.


def _so_digitos(valor: object) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def _formatar_exibicao(digitos: str) -> str:
    if len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    return digitos


def telefone_compras_valido(valor: Optional[str]) -> bool:
    if valor is None or not str(valor).strip():
        return True
    digitos = _so_digitos(valor)
    return len(digitos) in (10, 11)


def _montar_com_ddd(ddd: str, local: str) -> Optional[str]:
    if len(local) == 8:
        return f"{ddd}{local}"
    if len(local) == 9 and local.startswith("9"):
        return f"{ddd}{local}"
    return None


def _normalizar_bloco(bloco: str, ddd_padrao: str = DDD_PADRAO_COMPRAS) -> Optional[str]:
    texto = (bloco or "").strip()
    if not texto:
        return None

    ddd_explicito = None
    match_ddd = re.search(r"\(\s*(\d{2})\s*\)", texto)
    if match_ddd:
        ddd_explicito = match_ddd.group(1)
    elif re.match(r"^\d{2}\s", texto):
        ddd_explicito = texto[:2]

    digitos = _so_digitos(texto)
    if not digitos:
        return None

    while digitos.startswith("55") and len(digitos) > 11:
        digitos = digitos[2:]
    digitos = digitos.lstrip("0")

    if ddd_explicito:
        if digitos.startswith(ddd_explicito):
            local = digitos[len(ddd_explicito):]
            if len(local) in (8, 9):
                candidato = _montar_com_ddd(ddd_explicito, local)
            elif len(local) == 0 and len(digitos) in (10, 11):
                candidato = digitos
            else:
                candidato = None
        elif len(digitos) in (8, 9):
            candidato = _montar_com_ddd(ddd_explicito, digitos)
        elif len(digitos) in (10, 11):
            candidato = digitos
        else:
            candidato = None
    elif len(digitos) == 8:
        candidato = _montar_com_ddd(ddd_padrao, digitos)
    elif len(digitos) == 9 and digitos.startswith("9"):
        candidato = _montar_com_ddd(ddd_padrao, digitos)
    elif len(digitos) == 10:
        candidato = digitos
    elif len(digitos) == 11:
        candidato = digitos
    elif len(digitos) > 11:
        candidato = digitos[-11:] if digitos[-11:-9] != "00" else digitos[-10:]
        if len(candidato) not in (10, 11):
            candidato = digitos[-10:]
    else:
        candidato = None

    if not candidato or len(candidato) not in (10, 11):
        return None
    return candidato


def extrair_telefones_compras(valor: Optional[str], ddd_padrao: str = DDD_PADRAO_COMPRAS) -> list[str]:
    if valor is None or not str(valor).strip():
        return []

    texto = str(valor).strip()
    blocos = re.split(r"[/|,;]+|\s{2,}", texto)
    if len(blocos) == 1:
        blocos = re.split(r"\s+-\s+(?=[A-Za-z])", texto)
    if len(blocos) == 1:
        blocos = [texto]

    encontrados: list[str] = []
    for bloco in blocos:
        bloco = bloco.strip()
        if not bloco or re.fullmatch(r"[A-Za-zÀ-ú\s\.]+", bloco):
            continue
        normalizado = _normalizar_bloco(bloco, ddd_padrao=ddd_padrao)
        if normalizado and normalizado not in encontrados:
            encontrados.append(normalizado)
    if not encontrados:
        normalizado = _normalizar_bloco(texto, ddd_padrao=ddd_padrao)
        if normalizado:
            encontrados.append(normalizado)
    return encontrados


def sanitizar_telefone_compras(
    valor: Optional[str],
    ddd_padrao: str = DDD_PADRAO_COMPRAS,
) -> tuple[Optional[str], list[str]]:
    """Retorna telefone principal (só dígitos) e telefones extras normalizados."""
    telefones = extrair_telefones_compras(valor, ddd_padrao=ddd_padrao)
    if not telefones:
        return None, []
    return telefones[0], telefones[1:]


def formatar_telefone_compras(valor: Optional[str], ddd_padrao: str = DDD_PADRAO_COMPRAS) -> str:
    principal, extras = sanitizar_telefone_compras(valor, ddd_padrao=ddd_padrao)
    if not principal:
        return (valor or "").strip()
    partes = [_formatar_exibicao(principal)]
    partes.extend(_formatar_exibicao(extra) for extra in extras)
    return " / ".join(partes)
