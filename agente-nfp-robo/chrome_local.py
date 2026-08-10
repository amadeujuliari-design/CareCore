"""Chrome local com depuracao remota (CDP) para o portal NFP/SEFAZ."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
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


def _trazer_chrome_para_frente() -> bool:
    """Traz a janela do Chrome do robô para o primeiro plano (Windows)."""
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        SW_RESTORE = 9
        targets: list[tuple[int, int, str]] = []

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def _enum(hwnd, _lparam):  # type: ignore[misc]
            if not user32.IsWindowVisible(hwnd):
                return True
            buf = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, buf, 512)
            title = buf.value or ""
            if "Google Chrome" not in title:
                return True
            low = title.lower()
            if "nota fiscal" in low or "fazenda" in low or "nfp" in low:
                score = 4
            elif "nova guia" in low or "new tab" in low or title.strip() in {
                "Google Chrome",
                "about:blank - Google Chrome",
            }:
                score = 3
            else:
                score = 1
            targets.append((score, int(hwnd), title))
            return True

        user32.EnumWindows(_enum, 0)
        if not targets:
            return False
        targets.sort(key=lambda item: (-item[0], item[2]))
        hwnd = targets[0][1]
        user32.ShowWindow(hwnd, SW_RESTORE)
        fg = user32.GetForegroundWindow()
        fg_tid = wintypes.DWORD()
        cur_tid = kernel32.GetCurrentThreadId()
        user32.GetWindowThreadProcessId(fg, ctypes.byref(fg_tid))
        if fg_tid.value and fg_tid.value != cur_tid:
            user32.AttachThreadInput(cur_tid, fg_tid.value, True)
            user32.SetForegroundWindow(hwnd)
            user32.AttachThreadInput(cur_tid, fg_tid.value, False)
        else:
            user32.SetForegroundWindow(hwnd)
        return True
    except Exception:
        return False


def _cdp_put(url: str, timeout: float = 5.0) -> dict[str, Any]:
    req = urllib.request.Request(url, method="PUT")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw) if raw.strip() else {}


def _listar_paginas(cdp: str) -> list[dict[str, Any]]:
    base = cdp.rstrip("/")
    with urllib.request.urlopen(f"{base}/json/list", timeout=3) as resp:
        tabs = json.loads(resp.read().decode("utf-8", errors="replace"))
    if not isinstance(tabs, list):
        return []
    return [t for t in tabs if isinstance(t, dict) and t.get("type") == "page"]


def _ativar_aba(cdp: str, tab_id: str) -> None:
    base = cdp.rstrip("/")
    with urllib.request.urlopen(f"{base}/json/activate/{tab_id}", timeout=3) as resp:
        resp.read()


def _navegar_via_ws(ws_url: str, url: str) -> bool:
    """Navega com Page.navigate via WebSocket CDP (stdlib)."""
    try:
        import base64
        import hashlib
        import socket
        from urllib.parse import urlparse

        parsed = urlparse(ws_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 80
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        key = base64.b64encode(os.urandom(16)).decode("ascii")
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        ).encode("ascii")
        sock = socket.create_connection((host, port), timeout=5)
        try:
            sock.sendall(req)
            handshake = b""
            while b"\r\n\r\n" not in handshake:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                handshake += chunk
            accept = base64.b64encode(
                hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
            ).decode("ascii")
            if accept.encode("ascii") not in handshake:
                return False

            def _send(payload: dict[str, Any]) -> None:
                data = json.dumps(payload).encode("utf-8")
                mask = os.urandom(4)
                header = bytearray([0x81])
                n = len(data)
                if n < 126:
                    header.append(0x80 | n)
                elif n < 65536:
                    header.append(0x80 | 126)
                    header.extend(n.to_bytes(2, "big"))
                else:
                    header.append(0x80 | 127)
                    header.extend(n.to_bytes(8, "big"))
                header.extend(mask)
                masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
                sock.sendall(bytes(header) + masked)

            _send({"id": 1, "method": "Page.bringToFront"})
            _send({"id": 2, "method": "Page.navigate", "params": {"url": url}})
            time.sleep(0.2)
            return True
        finally:
            sock.close()
    except Exception:
        return False


def _abrir_aba_nfp_via_cdp(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    """Abre (ou foca) o portal NFP no Chrome que ja esta com depuracao."""
    base = cdp.rstrip("/")
    try:
        pages = _listar_paginas(cdp)
        alvo = None
        for tab in pages:
            u = str(tab.get("url") or "").lower()
            if "nfp.fazenda.sp.gov.br" in u:
                alvo = tab
                break
        if alvo and alvo.get("id"):
            _ativar_aba(cdp, str(alvo["id"]))
            ws = str(alvo.get("webSocketDebuggerUrl") or "")
            if ws:
                _navegar_via_ws(ws, URL_NFP)
            focado = _trazer_chrome_para_frente()
            return {
                "ok": True,
                "modo": "ativar_aba",
                "id": alvo.get("id"),
                "url": alvo.get("url") or URL_NFP,
                "janela_frente": focado,
            }
    except Exception:
        pass

    # Nova aba no portal
    try:
        encoded = urllib.parse.quote(URL_NFP, safe=":/?&=#%")
        data = _cdp_put(f"{base}/json/new?{encoded}")
        tab_id = data.get("id")
        if tab_id:
            try:
                _ativar_aba(cdp, str(tab_id))
            except Exception:
                pass
            ws = str(data.get("webSocketDebuggerUrl") or "")
            if ws:
                _navegar_via_ws(ws, URL_NFP)
            focado = _trazer_chrome_para_frente()
            return {
                "ok": True,
                "modo": "nova_aba",
                "id": tab_id,
                "url": data.get("url") or URL_NFP,
                "janela_frente": focado,
            }
    except Exception:
        pass

    try:
        pages = _listar_paginas(cdp)
        if pages and pages[0].get("id"):
            alvo = pages[0]
            _ativar_aba(cdp, str(alvo["id"]))
            ws = str(alvo.get("webSocketDebuggerUrl") or "")
            if ws:
                _navegar_via_ws(ws, URL_NFP)
            focado = _trazer_chrome_para_frente()
            return {
                "ok": True,
                "modo": "ativar_primeira",
                "id": alvo.get("id"),
                "url": URL_NFP,
                "janela_frente": focado,
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
            frente = " Trouxe a janela do Chrome para a frente." if nav.get("janela_frente") else (
                " Se nao aparecer, minimize outras janelas e procure o Chrome do robô."
            )
            return {
                "ok": True,
                "ja_estava_aberto": True,
                "mensagem": (
                    "Portal da Fazenda aberto no Chrome do robô."
                    + frente
                    + " Faça login/CAPTCHA até a tela Bem-vindo."
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
        "--new-window",
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
    for _ in range(20):
        time.sleep(0.4)
        atual = status_cdp(cdp)
        if atual.get("ok"):
            _trazer_chrome_para_frente()
            try:
                _abrir_aba_nfp_via_cdp(cdp)
            except Exception:
                pass
            _trazer_chrome_para_frente()
            return {
                "ok": True,
                "ja_estava_aberto": False,
                "mensagem": (
                    "Chrome aberto no portal NFP (janela do robô). "
                    "Faça login/CAPTCHA até a tela Bem-vindo."
                ),
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
