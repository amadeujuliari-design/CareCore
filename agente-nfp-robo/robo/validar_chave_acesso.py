#!/usr/bin/env python3
"""Validacao estrutural da chave de acesso NFe/NFC-e (44 digitos).

Espelho local do CareCore (`nfp_cupom_utils.validar_chave_acesso_nfe`) para o
robo nao depender do backend no PATH. Manter alinhado ao mudar a regra.
"""

from __future__ import annotations

import re

MODELOS_OK = frozenset({"55", "65"})


def digito_verificador_chave_nfe(base43: str) -> str:
    digitos = re.sub(r"\D", "", base43 or "")
    if len(digitos) != 43:
        raise ValueError("Base da chave deve ter 43 digitos.")
    soma = 0
    peso = 2
    for d in reversed(digitos):
        soma += int(d) * peso
        peso = 2 if peso == 9 else peso + 1
    resto = soma % 11
    dv = 0 if resto in (0, 1) else 11 - resto
    return str(dv)


def validar_chave_acesso_nfe(chave: str) -> tuple[bool, str]:
    digitos = re.sub(r"\D", "", chave or "")
    if len(digitos) != 44:
        return False, "Chave invalida: precisa ter exatamente 44 digitos."
    if not digitos.isdigit():
        return False, "Chave invalida: somente digitos."

    uf = digitos[0:2]
    if not (11 <= int(uf) <= 53):
        return False, f"Chave invalida: UF IBGE {uf} fora da faixa."

    aamm = digitos[2:6]
    mes = int(aamm[2:4])
    if mes < 1 or mes > 12:
        return False, f"Chave invalida: mes de emissao {aamm[2:4]} (AAMM={aamm})."

    modelo = digitos[20:22]
    if modelo not in MODELOS_OK:
        return False, f"Chave invalida: modelo {modelo} (esperado 55 ou 65)."

    try:
        dv_calc = digito_verificador_chave_nfe(digitos[:43])
    except ValueError:
        return False, "Chave invalida: nao foi possivel calcular o digito verificador."
    if digitos[43] != dv_calc:
        return (
            False,
            f"Chave invalida: digito verificador {digitos[43]} (esperado {dv_calc}).",
        )
    return True, ""
