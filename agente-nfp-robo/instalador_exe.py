#!/usr/bin/env python3
"""Instalador / atalho CareCore Agente NFP (gera .exe com PyInstaller).

Fluxo do usuario:
  1) Baixa CareCore-Agente-NFP.exe
  2) Se o Windows avisar, Desbloquear / Executar mesmo assim
  3) Este programa extrai o agente, instala deps e abre o painel de login
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

APP_NOME = "CareCore Agente NFP"
INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CareCorePlus" / "agente-nfp-robo"
VENV_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CareCorePlus" / "agente-nfp-robo-venv"
PAYLOAD_NOME = "agente_payload.zip"


def _pausar(msg: str = "Pressione Enter para fechar...") -> None:
    try:
        input(msg)
    except EOFError:
        pass


def _eh_congelado() -> bool:
    return bool(getattr(sys, "frozen", False))


def _pasta_recursos() -> Path:
    if _eh_congelado():
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent


def _achar_python() -> Optional[Path]:
    candidatos = [
        shutil.which("python"),
        shutil.which("py"),
        r"C:\Windows\py.exe",
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python" / "Python312" / "python.exe"),
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python" / "Python311" / "python.exe"),
        r"C:\Python312\python.exe",
        r"C:\Python311\python.exe",
    ]
    for c in candidatos:
        if not c:
            continue
        p = Path(c)
        if p.is_file():
            return p
    return None


def _rodar(cmd: list[str], *, cwd: Optional[Path] = None) -> None:
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def _extrair_payload() -> None:
    origem = _pasta_recursos() / PAYLOAD_NOME
    if not origem.is_file():
        # Modo desenvolvimento: copia pasta atual (sem venv/caches)
        src = Path(__file__).resolve().parent
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        for nome in (
            "agente_nfp.py",
            "painel.py",
            "carecore_api.py",
            "chrome_local.py",
            "contador_hud.py",
            "requirements.txt",
            "config.exemplo.json",
            "LEIA-ME.txt",
            "AGENTE_VERSAO.txt",
            "abrir_painel.bat",
            "abrir_chrome.bat",
            "instalar.bat",
            "iniciar_envio_continuo.bat",
            "iniciar_envio_lote.bat",
            "parar_envio.bat",
            "status.bat",
        ):
            f = src / nome
            if f.is_file():
                shutil.copy2(f, INSTALL_DIR / nome)
        robo_src = src / "robo"
        robo_dst = INSTALL_DIR / "robo"
        robo_dst.mkdir(parents=True, exist_ok=True)
        for f in robo_src.glob("*.py"):
            shutil.copy2(f, robo_dst / f.name)
        req = robo_src / "requirements.txt"
        if req.is_file():
            shutil.copy2(req, robo_dst / "requirements.txt")
        print(f"Arquivos copiados para {INSTALL_DIR}")
        return

    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(origem, "r") as zf:
            zf.extractall(tmp_path)
        # Preserva config.json existente
        config_atual = INSTALL_DIR / "config.json"
        backup = None
        if config_atual.is_file():
            backup = config_atual.read_bytes()
        for item in tmp_path.iterdir():
            dest = INSTALL_DIR / item.name
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)
        if backup is not None:
            config_atual.write_bytes(backup)
            print("Mantive seu config.json anterior.")
    enviar = INSTALL_DIR / "robo" / "enviar_fila.py"
    if not enviar.is_file():
        raise RuntimeError(
            "Instalacao incompleta: falta robo/enviar_fila.py no pacote. "
            "Baixe de novo o CareCore-Agente-NFP.exe do CareCore online."
        )
    # Guardrail: payload antigo ainda abria Doacao de Cupons sem CPF (bloqueio SEFAZ).
    navegar = INSTALL_DIR / "robo" / "navegar_doacao_aeb.py"
    if navegar.is_file():
        txt = navegar.read_text(encoding="utf-8", errors="ignore")
        if "Cadastramento de Cupons" not in txt:
            raise RuntimeError(
                "Pacote do agente desatualizado (falta fluxo Cadastramento de Cupons). "
                "Baixe de novo o CareCore-Agente-NFP.exe no CareCore online (v1.4.61+)."
            )
    print(f"Pacote extraido em {INSTALL_DIR}")


def _garantir_venv(python_exe: Path) -> Path:
    py_venv = VENV_DIR / "Scripts" / "python.exe"
    if not py_venv.is_file():
        print("Criando ambiente Python do agente...")
        _rodar([str(python_exe), "-m", "venv", str(VENV_DIR)])
    return VENV_DIR / "Scripts" / "python.exe"


def _instalar_deps(py_venv: Path) -> None:
    req = INSTALL_DIR / "requirements.txt"
    print("Instalando dependencias (pode demorar na primeira vez)...")
    _rodar([str(py_venv), "-m", "pip", "install", "--upgrade", "pip"])
    _rodar([str(py_venv), "-m", "pip", "install", "-r", str(req)])
    _rodar([str(py_venv), "-m", "pip", "install", "tzdata"])
    print("Instalando Chromium do Playwright (apoio)...")
    _rodar([str(py_venv), "-m", "playwright", "install", "chromium"])


def _criar_atalhos(py_venv: Path) -> None:
    atalho = INSTALL_DIR / "Abrir Painel CareCore NFP.bat"
    atalho.write_text(
        "@echo off\r\n"
        f'"{py_venv}" "{INSTALL_DIR / "painel.py"}"\r\n'
        "pause\r\n",
        encoding="utf-8",
    )
    desktop = Path.home() / "Desktop"
    if desktop.is_dir():
        try:
            shutil.copy2(atalho, desktop / atalho.name)
            print(f"Atalho criado na Area de Trabalho: {atalho.name}")
        except OSError:
            pass


def _abrir_painel(py_venv: Path) -> None:
    print("Abrindo painel de login (sincroniza fila online)...")
    print("Deixe a janela do painel aberta enquanto usa.")
    # Nova janela console no Windows
    creationflags = 0
    if sys.platform == "win32":
        creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    subprocess.Popen(
        [str(py_venv), str(INSTALL_DIR / "painel.py")],
        cwd=str(INSTALL_DIR),
        creationflags=creationflags,
    )


def main() -> int:
    print("=" * 52)
    print(f"  {APP_NOME}")
    print("=" * 52)
    print()
    print("Este instalador NAO e assinado digitalmente.")
    print("Se o Windows avisou, use Desbloquear / Executar mesmo assim.")
    print()

    python_sistema = _achar_python()
    if not python_sistema:
        print("ERRO: Python 3.11+ nao encontrado neste PC.")
        print("Instale em https://www.python.org/downloads/")
        print('Marque a opcao "Add python.exe to PATH" e rode este instalador de novo.')
        _pausar()
        return 1

    print(f"Python encontrado: {python_sistema}")
    try:
        _extrair_payload()
        if not (INSTALL_DIR / "config.json").is_file() and (INSTALL_DIR / "config.exemplo.json").is_file():
            shutil.copy2(INSTALL_DIR / "config.exemplo.json", INSTALL_DIR / "config.json")
        py_venv = _garantir_venv(python_sistema)
        _instalar_deps(py_venv)
        _criar_atalhos(py_venv)
        _abrir_painel(py_venv)
    except subprocess.CalledProcessError as exc:
        print(f"\nFalha na instalacao (codigo {exc.returncode}).")
        _pausar()
        return exc.returncode or 1
    except Exception as exc:
        print(f"\nErro: {exc}")
        _pausar()
        return 1

    print()
    print("Pronto. No painel: faca login CareCore -> Abrir site Fazenda -> Enviar.")
    print(f"Pasta do agente: {INSTALL_DIR}")
    _pausar("Pressione Enter para fechar este instalador (o painel continua aberto)...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
