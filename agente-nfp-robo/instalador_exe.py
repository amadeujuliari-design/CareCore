#!/usr/bin/env python3
"""Instalador / atalho CareCore Agente NFP (gera .exe com PyInstaller).

Fluxo do usuario:
  1) Baixa CareCore-Agente-NFP.exe
  2) Se o Windows avisar, Desbloquear / Executar mesmo assim
  3) Este programa extrai o agente, usa o Python portatil do pacote,
     instala deps e abre o painel de login — sem Python no PATH.
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
RUNTIME_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CareCorePlus" / "agente-nfp-python"
PAYLOAD_NOME = "agente_payload.zip"
PYTHON_RUNTIME_NOME = "python-runtime"


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


def _eh_python_store_stub(caminho: Path) -> bool:
    texto = str(caminho).replace("/", "\\").lower()
    return "\\windowsapps\\" in texto


def _python_utilizavel(caminho: Optional[Path]) -> bool:
    if not caminho or not caminho.is_file():
        return False
    if _eh_python_store_stub(caminho):
        return False
    try:
        proc = subprocess.run(
            [
                str(caminho),
                "-c",
                "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)",
            ],
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return proc.returncode == 0


def _ler_marcador(pasta: Path) -> str:
    marker = pasta / "CARECORE_PYTHON.txt"
    if not marker.is_file():
        return ""
    return marker.read_text(encoding="ascii", errors="ignore").strip()


def _achar_python_portatil_origem() -> Optional[Path]:
    candidatos = [
        INSTALL_DIR / PYTHON_RUNTIME_NOME / "python.exe",
        _pasta_recursos() / PYTHON_RUNTIME_NOME / "python.exe",
        Path(__file__).resolve().parent / PYTHON_RUNTIME_NOME / "python.exe",
    ]
    for bruto in candidatos:
        if _python_utilizavel(bruto):
            return bruto
    return None


def _garantir_python_portatil() -> Path:
    origem_exe = _achar_python_portatil_origem()
    if not origem_exe:
        raise RuntimeError(
            "Este pacote nao trouxe o Python portatil. "
            "Baixe de novo o CareCore-Agente-NFP.exe no CareCore online."
        )

    origem_dir = origem_exe.parent
    destino_exe = RUNTIME_DIR / "python.exe"
    origem_marca = _ler_marcador(origem_dir)
    destino_marca = _ler_marcador(RUNTIME_DIR)

    precisa_copiar = (
        not _python_utilizavel(destino_exe)
        or (origem_marca and origem_marca != destino_marca)
    )
    if precisa_copiar:
        print("Preparando Python portatil do CareCore (nao usa o Python da Microsoft Store)...")
        if RUNTIME_DIR.exists():
            shutil.rmtree(RUNTIME_DIR)
        shutil.copytree(origem_dir, RUNTIME_DIR)
        destino_exe = RUNTIME_DIR / "python.exe"

    if not _python_utilizavel(destino_exe):
        raise RuntimeError("Falha ao preparar o Python portatil do agente.")
    print(f"Python do agente: {destino_exe}")
    return destino_exe


def _rodar(cmd: list[str], *, cwd: Optional[Path] = None) -> None:
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def _extrair_payload() -> None:
    origem = _pasta_recursos() / PAYLOAD_NOME
    if not origem.is_file():
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
            "python_agente.cmd",
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
        runtime_src = src / PYTHON_RUNTIME_NOME
        if runtime_src.is_dir():
            runtime_dst = INSTALL_DIR / PYTHON_RUNTIME_NOME
            if runtime_dst.exists():
                shutil.rmtree(runtime_dst)
            shutil.copytree(runtime_src, runtime_dst)
        print(f"Arquivos copiados para {INSTALL_DIR}")
        return

    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(origem, "r") as zf:
            zf.extractall(tmp_path)
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
    navegar = INSTALL_DIR / "robo" / "navegar_doacao_aeb.py"
    if navegar.is_file():
        txt = navegar.read_text(encoding="utf-8", errors="ignore")
        if "Cadastramento de Cupons" not in txt:
            raise RuntimeError(
                "Pacote do agente desatualizado (falta fluxo Cadastramento de Cupons). "
                "Baixe de novo o CareCore-Agente-NFP.exe no CareCore online (v1.4.61+)."
            )
    if not (INSTALL_DIR / PYTHON_RUNTIME_NOME / "python.exe").is_file():
        raise RuntimeError(
            "Pacote incompleto: falta o Python portatil. "
            "Baixe de novo o CareCore-Agente-NFP.exe no CareCore online."
        )
    print(f"Pacote extraido em {INSTALL_DIR}")


def _instalar_deps(python_exe: Path) -> None:
    req = INSTALL_DIR / "requirements.txt"
    print("Instalando dependencias (pode demorar na primeira vez)...")
    _rodar([str(python_exe), "-m", "pip", "install", "--upgrade", "pip"])
    _rodar([str(python_exe), "-m", "pip", "install", "-r", str(req)])
    _rodar([str(python_exe), "-m", "pip", "install", "tzdata"])
    print("Instalando Chromium do Playwright (apoio)...")
    _rodar([str(python_exe), "-m", "playwright", "install", "chromium"])


def _criar_atalhos(python_exe: Path) -> None:
    atalho = INSTALL_DIR / "Abrir Painel CareCore NFP.bat"
    atalho.write_text(
        "@echo off\r\n"
        f'"{python_exe}" "{INSTALL_DIR / "painel.py"}"\r\n'
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


def _abrir_painel(python_exe: Path) -> None:
    print("Abrindo painel de login (sincroniza fila online)...")
    print("Deixe a janela do painel aberta enquanto usa.")
    creationflags = 0
    if sys.platform == "win32":
        creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    subprocess.Popen(
        [str(python_exe), str(INSTALL_DIR / "painel.py")],
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
    print("Nao e preciso instalar Python neste PC.")
    print()

    try:
        _extrair_payload()
        if not (INSTALL_DIR / "config.json").is_file() and (INSTALL_DIR / "config.exemplo.json").is_file():
            shutil.copy2(INSTALL_DIR / "config.exemplo.json", INSTALL_DIR / "config.json")
        python_exe = _garantir_python_portatil()
        _instalar_deps(python_exe)
        _criar_atalhos(python_exe)
        _abrir_painel(python_exe)
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
