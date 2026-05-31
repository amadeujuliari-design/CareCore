"""Captura screenshot da ficha da convivente Elaine para o site institucional."""

from __future__ import annotations

import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE_PUBLIC = ROOT / "carecore-site" / "public" / "telas"
OUTPUT = SITE_PUBLIC / "conviventes-elaine.png"
DB_PATH = ROOT / "carecore_local.db"
FRONTEND = "http://127.0.0.1:5173"
API_LOGIN = "http://127.0.0.1:8000/api/login"
ELAINE_NOME = "Elaine Barbosa Barbosa"


def login_demo() -> tuple[str, dict]:
    from security import gerar_hash_senha

    email = "diretor@carecore.com"
    senha = "Demo@12345"

    con = sqlite3.connect(DB_PATH)
    con.execute(
        "UPDATE usuarios SET senha_hash=? WHERE email=?",
        (gerar_hash_senha(senha), email),
    )
    con.commit()
    con.close()

    payload = json.dumps({"email": email, "senha": senha}).encode()
    req = urllib.request.Request(API_LOGIN, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())

    return data["access_token"], data["usuario"]


def capturar() -> None:
    token, usuario = login_demo()

    from playwright.sync_api import sync_playwright

    SITE_PUBLIC.mkdir(parents=True, exist_ok=True)

    init_script = f"""
        localStorage.setItem('@CareCore:token', {json.dumps(token)});
        localStorage.setItem('@CareCore:user', {json.dumps(json.dumps(usuario))});
    """

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page.add_init_script(init_script)

        page.goto(f"{FRONTEND}/conviventes", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1200)

        busca = page.get_by_placeholder("Pesquise por prontuário, nome ou CPF...")
        busca.fill(ELAINE_NOME)
        page.wait_for_timeout(800)

        page.get_by_role("button", name="Abrir Ficha").first.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        page.locator("img[alt='Foto Oficial']").first.wait_for(state="visible", timeout=20000)

        alvo = page.locator(".flex-1.overflow-auto, main").first
        alvo.screenshot(path=str(OUTPUT), type="png")

        browser.close()

    print(f"OK: {OUTPUT}")


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    capturar()
