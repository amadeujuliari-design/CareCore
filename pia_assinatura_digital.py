"""Validação de leitura da carteirinha para assinatura digital do formulário PIA."""
from __future__ import annotations

import re
import uuid

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def normalizar_codigo_carteirinha(valor: str | None) -> str:
    return "".join(ch for ch in str(valor or "").strip().lower() if ch.isalnum())


def cpf_apenas_digitos(valor: str | None) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def inferir_metodo_leitura(codigo_lido: str) -> str:
    bruto = str(codigo_lido or "").strip()
    if _UUID_RE.match(bruto):
        return "qr_code"
    return "codigo_barras"


def codigos_carteirinha_validos_convivente(convivente) -> set[str]:
    cpf_limpo = cpf_apenas_digitos(convivente.cpf)
    candidatos = {
        normalizar_codigo_carteirinha(convivente.id),
        normalizar_codigo_carteirinha(convivente.numero_institucional),
        normalizar_codigo_carteirinha(cpf_limpo),
        normalizar_codigo_carteirinha(str(convivente.id)[:8]),
    }
    return {codigo for codigo in candidatos if codigo}


def validar_codigo_carteirinha_convivente(convivente, codigo_lido: str | None) -> None:
    codigo_normalizado = normalizar_codigo_carteirinha(codigo_lido)
    if not codigo_normalizado:
        raise ValueError("Informe o código lido da carteirinha.")

    validos = codigos_carteirinha_validos_convivente(convivente)
    if codigo_normalizado not in validos:
        raise ValueError("A carteirinha lida não corresponde ao convivente deste prontuário.")


def normalizar_metodo_leitura(metodo: str | None, codigo_lido: str) -> str:
    valor = str(metodo or "").strip().lower()
    if valor in {"qr_code", "codigo_barras", "manual"}:
        return valor
    return inferir_metodo_leitura(codigo_lido)
