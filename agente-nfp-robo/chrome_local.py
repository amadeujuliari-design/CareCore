"""Chrome local com depuracao remota (CDP) para o portal NFP/SEFAZ."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

URL_NFP = "https://www.nfp.fazenda.sp.gov.br/"
CDP_PADRAO = "http://127.0.0.1:9222"


def status_cdp(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    url = f"{cdp.rstrip('/')}/json/version"
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        return {
            "ok": True,
            "cdp": cdp,
            "browser": data.get("Browser"),
            "webSocketDebuggerUrl": data.get("webSocketDebuggerUrl"),
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {"ok": False, "cdp": cdp, "erro": str(exc)}


def resolver_chrome() -> Optional[Path]:
    candidatos = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for p in candidatos:
        if p and p.is_file():
            return p
    return None


def _abrir_aba_nfp_via_cdp(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    """Abre (ou foca) o portal NFP no Chrome que ja esta com depuracao."""
    base = cdp.rstrip("/")
    # Preferencia: nova aba no portal
    try:
        url_new = f"{base}/json/new?{URL_NFP}"
        req = urllib.request.Request(url_new, method="PUT")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        return {
            "ok": True,
            "modo": "nova_aba",
            "id": data.get("id"),
            "url": data.get("url") or URL_NFP,
        }
    except Exception:
        pass
    try:
        with urllib.request.urlopen(f"{base}/json/list", timeout=3) as resp:
            tabs = json.loads(resp.read().decode("utf-8", errors="replace"))
        if not isinstance(tabs, list):
            tabs = []
        alvo = None
        for tab in tabs:
            u = str(tab.get("url") or "")
            if "nfp.fazenda.sp.gov.br" in u.lower():
                alvo = tab
                break
        if alvo is None and tabs:
            alvo = tabs[0]
        if alvo and alvo.get("id"):
            with urllib.request.urlopen(f"{base}/json/activate/{alvo['id']}", timeout=3) as resp:
                resp.read()
            return {
                "ok": True,
                "modo": "ativar_aba",
                "id": alvo.get("id"),
                "url": alvo.get("url") or URL_NFP,
            }
    except Exception as exc:
        return {"ok": False, "erro": str(exc)}
    return {"ok": False, "erro": "Nao foi possivel abrir aba no Chrome (CDP)."}


def abrir_chrome_fazenda(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    chrome = resolver_chrome()
    if not chrome:
        raise RuntimeError("Google Chrome nao encontrado nesta maquina.")

    porta = "9222"
    if "://" in cdp:
        try:
            porta = cdp.split(":")[-1].split("/")[0] or "9222"
        except Exception:
            porta = "9222"

    profile = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CareCorePlus" / "chrome-nfp-robo"
    profile.mkdir(parents=True, exist_ok=True)

    atual = status_cdp(cdp)
    if atual.get("ok"):
        nav = _abrir_aba_nfp_via_cdp(cdp)
        if nav.get("ok"):
            return {
                "ok": True,
                "ja_estava_aberto": True,
                "mensagem": (
                    "Portal da Fazenda aberto no Chrome do robô. "
                    "Faça login/CAPTCHA até a tela Bem-vindo."
                ),
                "cdp": atual,
                "navegacao": nav,
                "url": URL_NFP,
            }
        return {
            "ok": True,
            "ja_estava_aberto": True,
            "mensagem": (
                "Chrome do robô já está ativo, mas não consegui abrir a aba do portal. "
                f"Abra manualmente {URL_NFP} nessa janela do Chrome. "
                f"Detalhe: {nav.get('erro') or 'desconhecido'}"
            ),
            "cdp": atual,
            "url": URL_NFP,
        }

    args = [
        str(chrome),
        f"--remote-debugging-port={porta}",
        f"--user-data-dir={profile}",
        URL_NFP,
    ]
    creationflags = 0
    if sys.platform == "win32":
        creationflags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0
        )
    subprocess.Popen(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
        close_fds=True,
    )
    for _ in range(15):
        time.sleep(0.4)
        atual = status_cdp(cdp)
        if atual.get("ok"):
            return {
                "ok": True,
                "ja_estava_aberto": False,
                "mensagem": "Chrome aberto no portal NFP. Faca login/CAPTCHA ate Bem-vindo.",
                "cdp": atual,
                "url": URL_NFP,
            }
    return {
        "ok": True,
        "ja_estava_aberto": False,
        "mensagem": "Chrome iniciado; CDP ainda nao respondeu. Aguarde e tente de novo.",
        "cdp": status_cdp(cdp),
        "url": URL_NFP,
    }
