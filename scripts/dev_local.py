#!/usr/bin/env python3
"""
Orquestrador do ambiente local CareCore+ (Windows).

Fonte única de portas: scripts/dev_local.json

Uso recomendado:
  python scripts/dev_local.py start      # para tudo, sobe API + Vite, abre navegador
  python scripts/dev_local.py stop       # mata processos e libera portas
  python scripts/dev_local.py validate   # health + rotas críticas

Atalhos .bat na raiz: iniciar.bat, reiniciar_local.bat, parar_local.bat
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "carecore-front"
CONFIG_PATH = ROOT / "scripts" / "dev_local.json"
STATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "CareCorePlus"
STATE_PATH = STATE_DIR / "dev_local_state.json"
VENV_PYTHON = STATE_DIR / "venv" / "Scripts" / "python.exe"
DATABASE_URL = "sqlite+aiosqlite:///./carecore_aeb.db"
HOST = "127.0.0.1"


def carregar_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as arquivo:
        return json.load(arquivo)


def portas_monitoradas(config: dict) -> set[int]:
    portas = {int(config["frontend_port"]), int(config["api_port"])}
    portas.update(int(p) for p in config.get("legacy_api_ports", []))
    return portas


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


def executar_powershell(script: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def listar_pids_na_porta(porta: int) -> list[int]:
    resultado = executar_powershell(
        f"Get-NetTCPConnection -LocalPort {porta} -State Listen -ErrorAction SilentlyContinue | "
        f"Select-Object -ExpandProperty OwningProcess -Unique"
    )
    pids: list[int] = []
    for linha in resultado.stdout.splitlines():
        linha = linha.strip()
        if not linha:
            continue
        try:
            pid = int(linha)
        except ValueError:
            continue
        if pid > 0 and pid not in pids:
            pids.append(pid)
    return pids


def porta_esta_livre(porta: int) -> bool:
    return not listar_pids_na_porta(porta)


def matar_arvore(pid: int) -> None:
    if pid <= 0:
        return
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(pid)],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )


def liberar_porta(porta: int, tentativas: int = 6) -> None:
    for _ in range(tentativas):
        pids = listar_pids_na_porta(porta)
        if not pids:
            return
        for pid in pids:
            matar_arvore(pid)
        time.sleep(0.4)


def matar_uvicorn() -> None:
    raiz = str(ROOT).replace("'", "''")
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
        "Where-Object { "
        f"$_.CommandLine -like '*{raiz}*' -and $_.CommandLine -like '*uvicorn*' "
        "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
        "Where-Object { $_.CommandLine -like '*uvicorn main:app*' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def matar_vite() -> None:
    raiz = str(ROOT).replace("'", "''")
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | "
        "Where-Object { "
        f"($_.CommandLine -like '*{raiz}*' -and $_.CommandLine -like '*vite*') "
        "-or $_.CommandLine -like '*carecore-front*' "
        "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def matar_shells_orfas() -> None:
    raiz = str(ROOT).replace("'", "''")
    executar_powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | "
        "Where-Object { "
        f"$_.CommandLine -like '*CareCore+*' -or ($_.CommandLine -like '*{raiz}*' -and $_.CommandLine -like '*npm*') "
        "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def parar() -> None:
    config = carregar_config()
    estado = ler_estado()

    for chave in ("reloader_pid", "frontend_pid", "frontend_shell_pid"):
        matar_arvore(int(estado.get(chave) or 0))

    for pid in estado.get("frontend_pids") or []:
        matar_arvore(int(pid or 0))

    matar_uvicorn()
    matar_vite()
    matar_shells_orfas()

    for porta in sorted(portas_monitoradas(config)):
        liberar_porta(porta)

    if STATE_PATH.exists():
        STATE_PATH.unlink(missing_ok=True)

    ocupadas = [p for p in sorted(portas_monitoradas(config)) if not porta_esta_livre(p)]
    if ocupadas:
        print(f"Aviso: portas ainda ocupadas após parada: {ocupadas}")
        for porta in ocupadas:
            liberar_porta(porta, tentativas=3)
    else:
        print("CareCore+ local parado (portas liberadas).")


def exigir_portas_livres(config: dict) -> None:
    ocupadas: list[int] = []
    for porta in (int(config["api_port"]), int(config["frontend_port"])):
        if not porta_esta_livre(porta):
            liberar_porta(porta)
        if not porta_esta_livre(porta):
            pids = listar_pids_na_porta(porta)
            ocupadas.append(porta)
            print(f"  porta {porta} -> PID(s) {pids}")
    if ocupadas:
        raise SystemExit(
            f"Portas ocupadas: {ocupadas}. Feche outros servidores ou reinicie o Windows."
        )


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


def aguardar_frontend(config: dict, timeout_s: int = 60) -> list[int]:
    porta = int(config["frontend_port"])
    url = f"http://{HOST}:{porta}/"
    inicio = time.time()

    while time.time() - inicio < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=3) as resposta:
                if resposta.status == 200:
                    return listar_pids_na_porta(porta)
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(1)

    raise SystemExit(f"Timeout: frontend não respondeu em {url}")


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


def validar_ajustes_totais_rotina(config: dict) -> None:
    porta = int(config["api_port"])
    url = f"http://{HOST}:{porta}/api/rotina/ajustes-totais/dia?data=2020-01-01"
    ultimo_codigo = None
    for _ in range(12):
        try:
            urllib.request.urlopen(url, timeout=4)
            return
        except urllib.error.HTTPError as erro:
            ultimo_codigo = erro.code
            if erro.code in {401, 403, 422}:
                return
            if erro.code == 404:
                time.sleep(1)
                continue
            raise SystemExit(f"Validação de ajustes de totais falhou com HTTP {erro.code}") from erro
        except urllib.error.URLError:
            time.sleep(1)
            continue

    if ultimo_codigo == 404:
        raise SystemExit(
            f"Endpoint /api/rotina/ajustes-totais ausente na porta {porta}. "
            "Rode reiniciar_local.bat."
        )
    raise SystemExit(f"Não foi possível validar ajustes de totais na porta {porta}.")


def validar() -> None:
    config = carregar_config()
    dados = aguardar_health(config, timeout_s=5)
    validar_contagens(config)
    validar_ajustes_totais_rotina(config)
    porta = int(config["api_port"])
    print(f"OK: API local na porta {porta} — dashboard_api={dados.get('dashboard_api')}")


def subir_backend() -> int:
    config = carregar_config()
    porta = int(config["api_port"])
    python = resolver_python()

    if not (ROOT / "main.py").exists():
        raise SystemExit(f"main.py não encontrado em {ROOT}")

    exigir_portas_livres(config)

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

    print(f"Backend iniciando na porta {porta} (PID {processo.pid})...")
    aguardar_health(config)
    validar_contagens(config)
    validar_ajustes_totais_rotina(config)
    print(f"Backend validado: http://{HOST}:{porta}/api/health")
    return processo.pid


def subir_frontend() -> tuple[list[int], int]:
    config = carregar_config()
    porta_api = int(config["api_port"])
    porta_front = int(config["frontend_port"])

    if not (FRONTEND_DIR / "package.json").exists():
        raise SystemExit(f"Frontend não encontrado em {FRONTEND_DIR}")

    if not shutil.which("npm"):
        raise SystemExit("npm não encontrado no PATH. Instale o Node.js.")

    if not porta_esta_livre(porta_front):
        liberar_porta(porta_front)
    if not porta_esta_livre(porta_front):
        raise SystemExit(f"Porta {porta_front} ocupada — não foi possível subir o Vite.")

    env = os.environ.copy()
    env["CARECORE_DEV_API_PORT"] = str(porta_api)

    processo = subprocess.Popen(
        ["npm", "run", "dev:raw"],
        cwd=FRONTEND_DIR,
        env=env,
        creationflags=subprocess.CREATE_NEW_CONSOLE,
        shell=True,
    )

    print(f"Frontend iniciando na porta {porta_front} (PID {processo.pid}, proxy API -> {porta_api})...")
    pids = aguardar_frontend(config)
    print(f"Frontend validado: http://{HOST}:{porta_front}/")
    return pids, processo.pid


def abrir_navegador(config: dict) -> None:
    porta = int(config["frontend_port"])
    url = f"http://{HOST}:{porta}/"
    webbrowser.open(url)
    print(f"Navegador: {url}")


def iniciar_completo(abrir_browser: bool = True) -> None:
    config = carregar_config()
    porta_api = int(config["api_port"])
    porta_front = int(config["frontend_port"])

    print("Parando instâncias anteriores...")
    parar()
    time.sleep(1)

    reloader_pid = subir_backend()
    frontend_pids, frontend_shell_pid = subir_frontend()

    salvar_estado({
        "api_port": porta_api,
        "frontend_port": porta_front,
        "reloader_pid": reloader_pid,
        "frontend_shell_pid": frontend_shell_pid,
        "frontend_pids": frontend_pids,
        "frontend_pid": frontend_pids[0] if frontend_pids else frontend_shell_pid,
        "python": str(resolver_python()),
        "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    })

    validar()
    print()
    print(f"CareCore+ local pronto.")
    print(f"  App:  http://{HOST}:{porta_front}/")
    print(f"  API:  http://{HOST}:{porta_api}/api/health")
    print(f"  Parar: parar_local.bat")

    if abrir_browser:
        time.sleep(0.5)
        abrir_navegador(config)


def reiniciar() -> None:
    iniciar_completo(abrir_browser=True)


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)

    comando = sys.argv[1].strip().lower()
    acoes = {
        "stop": parar,
        "parar": parar,
        "start": lambda: iniciar_completo(abrir_browser=True),
        "iniciar": lambda: iniciar_completo(abrir_browser=True),
        "start-backend": lambda: subir_backend(),
        "backend": lambda: subir_backend(),
        "start-frontend": lambda: subir_frontend(),
        "frontend": lambda: subir_frontend(),
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
