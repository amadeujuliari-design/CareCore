# -*- coding: utf-8 -*-
"""Desmembra texto livre do campo contato (legado/importação)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from compras_telefone_utils import extrair_telefones_compras, sanitizar_telefone_compras

_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.I)
_RE_CNPJ = re.compile(r"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}")
_RE_ENDERECO = re.compile(
    r"^(AV\.?|RUA|R\.|AL\.|ALAMEDA|TRAVESSA|TV\.|ROD\.|ESTRADA|PÇ\.|PRAÇA)\b",
    re.I,
)
_RE_ENDERECO_NUM_BAIRRO = re.compile(
    r"^(?P<log>.+?)\s*,\s*(?P<num>\d+[A-Za-z]?)\s*(?:-\s*(?P<bairro>.+))?$",
    re.I,
)


@dataclass
class EnderecoParseado:
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    complemento: Optional[str] = None


@dataclass
class ContatoDesmembrado:
    representante: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: EnderecoParseado = field(default_factory=EnderecoParseado)


def _limpar_cnpj(valor: str) -> Optional[str]:
    digitos = re.sub(r"\D", "", valor or "")
    return digitos if len(digitos) == 14 else None


def _parse_endereco(texto: str) -> Optional[EnderecoParseado]:
    bruto = (texto or "").strip()
    if not bruto or not _RE_ENDERECO.search(bruto):
        return None
    match = _RE_ENDERECO_NUM_BAIRRO.match(bruto)
    if not match:
        return EnderecoParseado(logradouro=bruto)
    return EnderecoParseado(
        logradouro=(match.group("log") or "").strip(" ,") or None,
        numero=(match.group("num") or "").strip() or None,
        bairro=(match.group("bairro") or "").strip() or None,
    )


def desmembrar_contato_livre(
    contato: Optional[str],
    *,
    cnpj_atual: Optional[str] = None,
    email_atual: Optional[str] = None,
    telefone_atual: Optional[str] = None,
) -> ContatoDesmembrado:
    texto = (contato or "").strip()
    if not texto:
        return ContatoDesmembrado()

    resultado = ContatoDesmembrado()
    restante = texto

    email_match = _RE_EMAIL.search(restante)
    if email_match:
        if not email_atual:
            resultado.email = email_match.group(0).strip().lower()
        restante = restante.replace(email_match.group(0), " ").strip(" ,;-")

    cnpj_match = _RE_CNPJ.search(restante)
    if cnpj_match and not cnpj_atual:
        cnpj_limpo = _limpar_cnpj(cnpj_match.group(0))
        if cnpj_limpo:
            resultado.cnpj = cnpj_limpo
            restante = restante.replace(cnpj_match.group(0), " ").strip(" ,;-")

    if not telefone_atual:
        tel, _ = sanitizar_telefone_compras(restante)
        if tel:
            resultado.telefone = tel
            for bruto_tel in extrair_telefones_compras(restante):
                restante = re.sub(re.sub(r"\D", "", bruto_tel), "", restante, count=1)
            restante = re.sub(r"\(\s*\d{2}\s*\)[\d\s\-]+", "", restante).strip(" ,;-")

    endereco = _parse_endereco(restante)
    if endereco and endereco.logradouro:
        resultado.endereco = endereco
        restante = ""

    representante = re.sub(r"\s+", " ", restante).strip(" ,;-")
    if representante and not _RE_ENDERECO.search(representante):
        if _limpar_cnpj(representante):
            if not cnpj_atual and not resultado.cnpj:
                resultado.cnpj = _limpar_cnpj(representante)
        elif "@" not in representante:
            resultado.representante = representante

    return resultado


def formatar_endereco_fornecedor(registro: dict) -> str:
    partes = []
    log = (registro.get("logradouro") or "").strip()
    num = (registro.get("numero") or "").strip()
    if log:
        partes.append(f"{log}{f', {num}' if num else ''}")
    bairro = (registro.get("bairro") or "").strip()
    if bairro:
        partes.append(bairro)
    cidade = (registro.get("cidade") or "").strip()
    uf = (registro.get("uf") or "").strip()
    if cidade:
        partes.append(f"{cidade}/{uf}" if uf else cidade)
    elif uf:
        partes.append(uf)
    cep = re.sub(r"\D", "", registro.get("cep") or "")
    if len(cep) == 8:
        partes.append(f"CEP {cep[:5]}-{cep[5:]}")
    return " · ".join(partes)
