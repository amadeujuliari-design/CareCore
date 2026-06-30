#!/usr/bin/env python3
"""
Orquestrador do ambiente local CareCore+ (Windows).

Uso:
  python scripts/dev_local.py stop
  python scripts/dev_local.py start-backend
  python scripts/dev_local.py validate
  python scripts/dev_local.py restart

Porta e requisitos de health: scripts/dev_local.json (fonte única).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "dev_local.json"
STATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "CareCorePlus"
STATE_PATH = STATE_DIR / "dev_local_state.json"
VENV_PYTHON = STATE_DIR / "venv" / "Scripts" / "python.exe"
DATABASE_URL = "sqlite+aiosqlite:///./carecore_aeb.db"
HOST = "127.0.0.1"


def carregar_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as arquivo:
        return json.load(arquivo)


def salvar_estado(dados: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(dados, indent=2), encoding="utf-8")


def ler_estado() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def executar_powershell(script: str) -> None:
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        cwd=ROOT,
        check=False,
    )


def matar_pid(pid: int) -> None:
    if pid <= 0:
        return
    subprocess.run(["taskkill", "/F", "/PID", str(pid)], cwd=ROOT, check=False, capture_output=True)


def liberar_porta(porta: int) -> None:
    executar_powershell(
        f"1..3 | ForEach-Object {{ "
        f"Get-NetTCPConnection -LocalPort {porta} -State Listen -ErrorAction SilentlyContinue | "
        f"Select-Object -ExpandProperty OwningProcess -Unique | "
        f"ForEach-Object {{ if ($_ -gt 0) {{ Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }} }}; "
        f"Start-Sleep -Milliseconds 300 }}"
    )


def matar_uvicorn() -> None:
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
        "Where-Object { $_.CommandLine -like '*uvicorn main:app*' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def matar_vite() -> None:
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | "
        "Where-Object { $_.CommandLine -like '*vite*' -or $_.CommandLine -like '*carecore-front*' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def parar() -> None:
    config = carregar_config()
    estado = ler_estado()
    matar_pid(int(estado.get("reloader_pid") or 0))

    portas = {int(config["frontend_port"]), int(config["api_port"])}
    portas.update(int(p) for p in config.get("legacy_api_ports", []))

    matar_uvicorn()
    matar_vite()

    for porta in sorted(portas):
        liberar_porta(porta)

    if STATE_PATH.exists():
        STATE_PATH.unlink(missing_ok=True)

    print("CareCore+ local parado (portas liberadas).")


def resolver_python() -> Path:
    if VENV_PYTHON.exists():
        return VENV_PYTHON
    return Path(sys.executable)


def aguardar_health(config: dict, timeout_s: int = 45) -> dict:
    porta = int(config["api_port"])
    url = f"http://{HOST}:{porta}/api/health"
    health = config.get("health", {})
    inicio = time.time()

    while time.time() - inicio < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=3) as resposta:
                dados = json.loads(resposta.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(1)
            continue

        if all(dados.get(chave) == valor for chave, valor in health.items()):
            return dados

        raise SystemExit(
            "API respondeu mas desatualizada: "
            f"{json.dumps(dados, ensure_ascii=False)} "
            f"(esperado health={health})"
        )

    raise SystemExit(f"Timeout: API não respondeu em http://{HOST}:{porta}/api/health")


def validar_contagens(config: dict) -> None:
    porta = int(config["api_port"])
    url = f"http://{HOST}:{porta}/api/dashboard/contagens-conviventes"
    try:
        urllib.request.urlopen(url, timeout=4)
    except urllib.error.HTTPError as erro:
        if erro.code == 401:
            return
        if erro.code == 404:
            raise SystemExit(
                f"Endpoint /api/dashboard/contagens-conviventes ausente na porta {porta}. "
                "Backend antigo ou porta errada."
            ) from erro
        raise SystemExit(f"Validação de contagens falhou com HTTP {erro.code}") from erro
    except urllib.error.URLError as erro:
        raise SystemExit(f"Não foi possível validar contagens: {erro}") from erro


def validar() -> None:
    config = carregar_config()
    dados = aguardar_health(config, timeout_s=5)
    validar_contagens(config)
    porta = int(config["api_port"])
    print(f"OK: API local na porta {porta} — dashboard_api={dados.get('dashboard_api')}")


def subir_backend() -> None:
    config = carregar_config()
    porta = int(config["api_port"])
    python = resolver_python()

    if not (ROOT / "main.py").exists():
        raise SystemExit(f"main.py não encontrado em {ROOT}")

    comando = [
        str(python),
        "-m",
        "uvicorn",
        "main:app",
        "--reload",
        "--host",
        HOST,
        "--port",
        str(porta),
    ]

    env = os.environ.copy()
    env["DATABASE_URL"] = DATABASE_URL

    processo = subprocess.Popen(
        comando,
        cwd=ROOT,
        env=env,
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )

    salvar_estado({
        "api_port": porta,
        "reloader_pid": processo.pid,
        "python": str(python),
        "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    })

    print(f"Backend iniciando na porta {porta} (PID {processo.pid})...")
    aguardar_health(config)
    validar_contagens(config)
    print(f"Backend validado: http://{HOST}:{porta}/api/health")


def reiniciar() -> None:
    parar()
    time.sleep(1)
    subir_backend()
    config = carregar_config()
    porta = int(config["api_port"])
    frontend = int(config["frontend_port"])
    print()
    print("Próximo passo: subir o frontend com reiniciar_local.bat ou:")
    print(f"  cd carecore-front && set CARECORE_DEV_API_PORT={porta} && npm run dev")
    print(f"Frontend: http://{HOST}:{frontend}  |  API: http://{HOST}:{porta}")


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)

    comando = sys.argv[1].strip().lower()
    acoes = {
        "stop": parar,
        "parar": parar,
        "start-backend": subir_backend,
        "backend": subir_backend,
        "validate": validar,
        "validar": validar,
        "restart": reiniciar,
        "reiniciar": reiniciar,
    }

    acao = acoes.get(comando)
    if not acao:
        print(f"Comando desconhecido: {comando}")
        raise SystemExit(2)

    acao()


if __name__ == "__main__":
    main()
