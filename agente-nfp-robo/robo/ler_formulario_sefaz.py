#!/usr/bin/env python3
"""Leitura rapida dos campos do formulario SEFAZ apos informar a chave."""

from __future__ import annotations

import re
from typing import Any


def _centavos_de_texto(txt: str) -> int | None:
    bruto = (txt or "").strip()
    if not bruto:
        return None
    if re.match(r"^\d{1,3}(\.\d{3})*,\d{2}$", bruto):
        normal = bruto.replace(".", "").replace(",", ".")
    else:
        normal = bruto.replace(",", ".")
    try:
        return int(round(float(normal) * 100))
    except ValueError:
        return None


def _data_iso_de_texto(txt: str) -> str | None:
    bruto = (txt or "").strip()
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", bruto)
    if not m:
        return None
    d, mes, ano = m.groups()
    return f"{ano}-{mes}-{d}"


async def aguardar_e_ler_formulario_sefaz(
    page,
    *,
    timeout_ms: int = 300,
    intervalo_ms: int = 50,
) -> dict[str, Any]:
    """Poll curto: le numero/valor/CNPJ/data preenchidos pela SEFAZ (sem atrasar a fila)."""
    tentativas = max(1, int(timeout_ms / max(intervalo_ms, 25)))
    ultimo: dict[str, Any] = {}
    for _ in range(tentativas):
        ultimo = await _ler_formulario_sefaz(page)
        if ultimo.get("numero_nota_sefaz") or ultimo.get("valor_sefaz_centavos"):
            return ultimo
        await page.wait_for_timeout(intervalo_ms)
    return ultimo


async def _ler_formulario_sefaz(page) -> dict[str, Any]:
    try:
        bruto = await page.evaluate(
            """() => {
              const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
              const out = { numero_nota_sefaz: '', cnpj_sefaz: '', valor_sefaz: '', data_nota_sefaz: '' };
              const setIf = (k, v) => {
                const t = (v || '').trim();
                if (t && !out[k]) out[k] = t;
              };
              const inputs = Array.from(document.querySelectorAll('input, textarea'));
              const readVal = (el) => {
                if (!el) return '';
                if (el.disabled && !el.value) return '';
                return (el.value || el.getAttribute('value') || '').trim();
              };
              const idMap = [
                ['numero_nota_sefaz', /numero.*nota|n[uú]mero.*nota|nota.*n[uú]mero|nro.*nota/i],
                ['cnpj_sefaz', /cnpj/i],
                ['valor_sefaz', /valor.*nota|valor.*nf|valor\\s*\\(/i],
                ['data_nota_sefaz', /data.*nota|emiss[aã]o/i],
              ];
              for (const el of inputs) {
                const id = norm(el.id || '');
                const name = norm(el.name || '');
                const ph = norm(el.placeholder || '');
                const blob = `${id} ${name} ${ph}`;
                const val = readVal(el);
                if (!val || val.length > 80) continue;
                for (const [campo, re] of idMap) {
                  if (re.test(blob)) setIf(campo, val);
                }
                if (el.maxLength === 44 && val.replace(/\\D/g, '').length === 44) continue;
              }
              const labels = Array.from(document.querySelectorAll('label, span, td, th, div, li'));
              for (const el of labels) {
                const texto = norm(el.innerText || el.textContent || '');
                if (!texto || texto.length > 60) continue;
                let campo = null;
                if (/n[uú]mero.*nota|nota fiscal.*n/.test(texto)) campo = 'numero_nota_sefaz';
                else if (/cnpj/.test(texto)) campo = 'cnpj_sefaz';
                else if (/valor.*nota|valor da nota/.test(texto)) campo = 'valor_sefaz';
                else if (/data.*nota|data da nota|emiss[aã]o/.test(texto)) campo = 'data_nota_sefaz';
                if (!campo) continue;
                const row = el.closest('tr, .row, .form-group, fieldset, div');
                const scope = row || el.parentElement;
                if (!scope) continue;
                const campoEl = scope.querySelector('input:not([type=hidden]), textarea');
                if (campoEl) setIf(campo, readVal(campoEl));
              }
              return out;
            }"""
        )
    except Exception:
        return {}

    numero = re.sub(r"\D", "", str(bruto.get("numero_nota_sefaz") or ""))
    cnpj = re.sub(r"\D", "", str(bruto.get("cnpj_sefaz") or ""))
    valor_cent = _centavos_de_texto(str(bruto.get("valor_sefaz") or ""))
    data_iso = _data_iso_de_texto(str(bruto.get("data_nota_sefaz") or ""))

    saida: dict[str, Any] = {}
    if numero:
        saida["numero_nota_sefaz"] = numero.lstrip("0") or numero
    if len(cnpj) >= 11:
        saida["cnpj_sefaz"] = cnpj
    if valor_cent is not None and valor_cent > 0:
        saida["valor_sefaz_centavos"] = valor_cent
    if data_iso:
        saida["data_nota_sefaz"] = data_iso
    return saida


def captura_metadados_habilitada() -> bool:
    import os

    flag = (os.environ.get("CARECORE_NFP_CAPTURAR_METADADOS") or "1").strip().lower()
    return flag not in {"0", "false", "off", "nao", "não"}
