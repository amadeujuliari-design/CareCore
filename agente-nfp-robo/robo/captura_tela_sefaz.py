#!/usr/bin/env python3
"""Screenshots e dump de campos da tela SEFAZ (debug de metadados)."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

CAPTURAS_DIR = Path(__file__).resolve().parent / "_capturas"


def captura_tela_habilitada() -> bool:
    flag = (os.environ.get("CARECORE_NFP_CAPTURA_TELA") or "1").strip().lower()
    return flag not in {"0", "false", "off", "nao", "não"}


def _sufixo_chave(chave: str) -> str:
    dig = re.sub(r"\D", "", chave or "")
    return dig[-8:] if len(dig) >= 8 else dig or "semchave"


async def _dump_campos_visiveis(page) -> list[dict[str, Any]]:
    try:
        return await page.evaluate(
            """() => Array.from(document.querySelectorAll('input, textarea, select'))
              .filter((el) => {
                const st = window.getComputedStyle(el);
                if (!st || st.display === 'none' || st.visibility === 'hidden') return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              })
              .slice(0, 80)
              .map((el) => ({
                tag: el.tagName,
                type: el.type || '',
                id: el.id || '',
                name: el.name || '',
                value: (el.value || el.getAttribute('value') || '').slice(0, 120),
                maxLength: el.maxLength,
                disabled: !!el.disabled,
                readOnly: !!el.readOnly,
              }))"""
        )
    except Exception:
        return []


async def gravar_captura_sefaz(
    page,
    *,
    etapa: str,
    chave: str,
    meta: dict[str, Any] | None = None,
    url: str = "",
) -> Path | None:
    """Grava PNG + JSON dos campos visiveis. Retorna caminho do PNG."""
    if not captura_tela_habilitada():
        return None

    CAPTURAS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sufixo = _sufixo_chave(chave)
    base = CAPTURAS_DIR / f"sefaz_{etapa}_{sufixo}_{stamp}"
    png = base.with_suffix(".png")
    js = base.with_suffix(".json")

    campos = await _dump_campos_visiveis(page)
    try:
        url_atual = url or page.url
    except Exception:
        url_atual = url or ""

    payload = {
        "etapa": etapa,
        "chave_fim": sufixo,
        "url": url_atual,
        "meta_lida": meta or {},
        "campos_visiveis": campos,
    }
    try:
        js.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass

    try:
        await page.screenshot(path=str(png), full_page=True)
        print(f"Captura tela: {png.name} (+ {js.name})")
        return png
    except Exception as exc:
        print(f"Aviso: falha screenshot {etapa}: {exc}")
        return None
