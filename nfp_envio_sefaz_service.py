"""Operacao local do robo NFP (Chrome CDP + enviar_fila).

So funciona na API local da estacao (nao no Fly). O Chrome do operador
precisa estar nesta mesma maquina.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parent
ROBO_DIR = ROOT_DIR / "scripts" / "nfp_robo"
ENVIAR_FILA = ROBO_DIR / "enviar_fila.py"
FUSO = ZoneInfo("America/Sao_Paulo")
CDP_PADRAO = os.getenv("CARECORE_NFP_CDP", "http://127.0.0.1:9222").rstrip("/")
URL_NFP = "https://www.nfp.fazenda.sp.gov.br/"
PLANILHA_PADRAO = Path.home() / "Downloads" / "Chave-de-acesso lançamento das notas na sefaz.xlsx"
STOP_FLAG = ROBO_DIR / "_capturas" / "fila_parar.flag"

_job_lock = threading.Lock()
_job_proc: Optional[subprocess.Popen] = None
_job: dict[str, Any] = {
    "status": "idle",
    "iniciado_em": None,
    "terminado_em": None,
    "fonte": None,
    "mensagem": "",
    "resumo": {},
    "itens": [],
    "log_path": None,
    "pid": None,
    "cancel_solicitado": False,
}


def robo_disponivel_neste_ambiente() -> bool:
    if os.getenv("FLY_APP_NAME"):
        return False
    flag = (os.getenv("CARECORE_NFP_ROBO") or "").strip().lower()
    if flag in {"0", "false", "off", "nao", "não"}:
        return False
    if flag in {"1", "true", "on", "sim"}:
        return True
    # Padrao: habilitado fora do Fly
    return True


def _agora_iso() -> str:
    return datetime.now(FUSO).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")


def status_cdp(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    url = f"{cdp}/json/version"
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


def _resolver_chrome() -> Optional[Path]:
    candidatos = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for p in candidatos:
        if p and p.is_file():
            return p
    return None


def abrir_chrome_fazenda(cdp: str = CDP_PADRAO) -> dict[str, Any]:
    if not robo_disponivel_neste_ambiente():
        raise RuntimeError(
            "Robo NFP so pode rodar na API local desta estacao (nao no servidor online)."
        )
    chrome = _resolver_chrome()
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

    # Se CDP ja responde, nao abre segunda instancia desnecessaria
    atual = status_cdp(cdp)
    if atual.get("ok"):
        return {
            "ok": True,
            "ja_estava_aberto": True,
            "mensagem": "Chrome com depuracao ja esta ativo. Faca login ate a tela Bem-vindo; o robo abre DoacaoNotas/AEB sozinho.",
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
    # Espera curta o CDP subir
    for _ in range(15):
        time.sleep(0.4)
        atual = status_cdp(cdp)
        if atual.get("ok"):
            return {
                "ok": True,
                "ja_estava_aberto": False,
                "mensagem": "Chrome aberto no portal NFP. Faca login/CAPTCHA ate a tela Bem-vindo; o robo abre DoacaoNotas e seleciona AEB ao rodar a fila.",
                "cdp": atual,
                "url": URL_NFP,
            }
    return {
        "ok": True,
        "ja_estava_aberto": False,
        "mensagem": "Chrome iniciado; CDP ainda nao respondeu. Aguarde alguns segundos e atualize o status.",
        "cdp": status_cdp(cdp),
        "url": URL_NFP,
    }


def snapshot_job() -> dict[str, Any]:
    with _job_lock:
        # Nao expor handle interno do processo
        return {k: v for k, v in _job.items() if k != "_proc"}


def _set_job(**kwargs) -> None:
    with _job_lock:
        _job.update(kwargs)


def _limpar_stop_flag() -> None:
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass


def _marcar_stop_flag() -> None:
    STOP_FLAG.parent.mkdir(parents=True, exist_ok=True)
    STOP_FLAG.write_text("1", encoding="utf-8")


def parar_envio_fila() -> dict[str, Any]:
    """Pede parada cooperativa; forca encerramento em background se necessario."""
    global _job_proc
    with _job_lock:
        rodando = _job.get("status") == "running"
        if not rodando:
            job_snap = {k: v for k, v in _job.items() if k != "_proc"}
            return {
                "ok": False,
                "mensagem": "Nenhum envio em andamento.",
                "job": job_snap,
            }
        _job["cancel_solicitado"] = True
        _job["mensagem"] = "Parada solicitada — aguardando o item atual..."
        proc = _job_proc

    _marcar_stop_flag()

    def _forcar_se_preciso(p: Optional[subprocess.Popen]) -> None:
        if p is None:
            return
        try:
            p.wait(timeout=60)
            return
        except subprocess.TimeoutExpired:
            pass
        try:
            p.terminate()
        except OSError:
            return
        try:
            p.wait(timeout=15)
        except subprocess.TimeoutExpired:
            try:
                p.kill()
            except OSError:
                pass

    threading.Thread(target=_forcar_se_preciso, args=(proc,), daemon=True).start()

    return {
        "ok": True,
        "mensagem": "Parada solicitada. A fila encerra apos o item atual e sincroniza o CareCore.",
        "job": snapshot_job(),
    }


def _python_exe() -> str:
    return sys.executable


def _aplicar_resultados_no_banco(db_factory, organizacao_id: str, itens: list[dict]) -> int:
    """Atualiza nfp_cupons_lidos conforme retorno do robo. Retorna qtd atualizada."""
    if not itens:
        return 0
    # Import lazy para nao circular no import do modulo
    import asyncio

    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models import NfpCupomLidoDB
    from time_operacional import agora_operacional_naive

    async def _run() -> int:
        atualizados = 0
        async with AsyncSessionLocal() as db:
            for item in itens:
                chave = "".join(ch for ch in str(item.get("chave") or "") if ch.isdigit())
                if len(chave) != 44:
                    continue
                status_cc = (item.get("status_carecore") or "").strip().lower()
                tipo = (item.get("tipo") or "").strip().lower()
                if status_cc not in {"enviado", "erro", "pendente"}:
                    if tipo in {"sucesso", "ja_existe"}:
                        status_cc = "enviado"
                    elif tipo == "erro":
                        status_cc = "erro"
                    else:
                        continue
                row = (
                    await db.execute(
                        select(NfpCupomLidoDB).where(
                            NfpCupomLidoDB.organizacao_id == organizacao_id,
                            NfpCupomLidoDB.chave == chave,
                        )
                    )
                ).scalar_one_or_none()
                if not row:
                    continue
                row.status = status_cc
                row.mensagem = (item.get("mensagem") or row.mensagem or "")[:2000] or row.mensagem
                row.atualizado_em = agora_operacional_naive()
                if status_cc == "enviado":
                    row.enviado_em = agora_operacional_naive()
                # Libera metadados de reserva apos o resultado do item.
                row.lote_id = None
                row.reservado_em = None
                row.reservado_por = None
                atualizados += 1
            await db.commit()
        return atualizados

    try:
        return asyncio.run(_run())
    except RuntimeError:
        # Ja existe loop — usa novo loop em thread (caller ja esta em thread)
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()



def iniciar_envio_fila(
    *,
    organizacao_id: str,
    fonte: str = "pendentes",
    chaves: Optional[list[str]] = None,
    limite: Optional[int] = None,
    cdp: str = CDP_PADRAO,
    usuario_id: Optional[str] = None,
) -> dict[str, Any]:
    """Inicia sessao de envio.

    Pendentes CareCore: reserva em fatias de 100.
    - limite informado = teto da sessao (ex.: 500 → ate 5 lotes de 100)
    - limite vazio = continuo (novo lote de 100 apos o anterior)
    """
    if not robo_disponivel_neste_ambiente():
        raise RuntimeError(
            "Robo NFP so pode rodar na API local desta estacao (nao no servidor online)."
        )
    cdp_info = status_cdp(cdp)
    if not cdp_info.get("ok"):
        raise RuntimeError(
            "Chrome com depuracao (porta 9222) nao esta ativo. Use 'Abrir site Fazenda' e faca login."
        )

    with _job_lock:
        if _job.get("status") == "running":
            raise RuntimeError("Ja existe um envio em andamento. Aguarde terminar ou use Parar.")

    fonte_n = (fonte or "pendentes").strip().lower()
    if fonte_n not in {"pendentes", "planilha"}:
        raise ValueError("fonte deve ser 'pendentes' ou 'planilha'.")

    continuo = fonte_n == "pendentes" and limite is None
    mensagem_ini = (
        "Envio continuo em lotes de 100 (em branco = ate acabar ou Parar)..."
        if continuo
        else f"Envio em andamento (sessao ate {limite} chave(s), lotes de 100)..."
        if fonte_n == "pendentes"
        else f"Envio em andamento ({limite or 'todas'} chave(s) da planilha)..."
    )

    _limpar_stop_flag()
    _set_job(
        status="running",
        iniciado_em=_agora_iso(),
        terminado_em=None,
        fonte=fonte_n,
        mensagem=mensagem_ini,
        resumo={
            "fila_tamanho": 0,
            "limite": limite,
            "continuo": continuo,
            "tamanho_lote": 100,
            "lotes_processados": 0,
            "enviados_sessao": 0,
        },
        itens=[],
        log_path=None,
        stdout_tail="",
        pid=None,
        cancel_solicitado=False,
    )

    th = threading.Thread(
        target=_worker_sessao_envio,
        kwargs={
            "organizacao_id": organizacao_id,
            "fonte": fonte_n,
            "chaves_planilha": chaves,
            "limite_sessao": limite,
            "continuo": continuo,
            "cdp": cdp,
            "usuario_id": usuario_id,
        },
        daemon=True,
    )
    th.start()
    return {
        "ok": True,
        "mensagem": "Envio iniciado em segundo plano.",
        "job": snapshot_job(),
        "planilha_padrao": str(PLANILHA_PADRAO),
        "planilha_existe": PLANILHA_PADRAO.is_file(),
        "fila_tamanho": 0,
        "tamanho_lote": 100,
        "continuo": continuo,
    }


def _worker_sessao_envio(
    *,
    organizacao_id: str,
    fonte: str,
    chaves_planilha: Optional[list[str]],
    limite_sessao: Optional[int],
    continuo: bool,
    cdp: str,
    usuario_id: Optional[str],
) -> None:
    from nfp_cupom_reserva_service import (
        TAMANHO_LOTE_PADRAO,
        liberar_lote_sync,
        liberar_reservas_expiradas_sync,
        reservar_lote_cupons_sync,
    )

    lotes_ok = 0
    enviados_sessao = 0
    restante = int(limite_sessao) if limite_sessao is not None else None
    ultimo_lote_id: Optional[str] = None
    todos_itens: list[dict] = []

    try:
        if fonte == "planilha":
            lista = []
            for c in chaves_planilha or []:
                dig = "".join(ch for ch in str(c) if ch.isdigit())
                if len(dig) == 44:
                    lista.append({"chave": dig})
            if limite_sessao:
                lista = lista[: int(limite_sessao)]
            if not lista:
                # Fallback: planilha inteira via script
                if not PLANILHA_PADRAO.is_file():
                    raise RuntimeError(f"Planilha nao encontrada: {PLANILHA_PADRAO}")
                _rodar_um_lote_robo(
                    organizacao_id=organizacao_id,
                    caminho_json=None,
                    caminho_planilha=PLANILHA_PADRAO,
                    cdp=cdp,
                    acumular_itens=todos_itens,
                )
            else:
                while lista:
                    with _job_lock:
                        if _job.get("cancel_solicitado"):
                            break
                    pedaco = lista[:TAMANHO_LOTE_PADRAO]
                    lista = lista[TAMANHO_LOTE_PADRAO:]
                    out_dir = ROBO_DIR / "_capturas"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    stamp = datetime.now(FUSO).strftime("%Y%m%d_%H%M%S")
                    caminho_json = out_dir / f"fila_planilha_lote_{stamp}.json"
                    caminho_json.write_text(
                        json.dumps(pedaco, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    _set_job(
                        mensagem=f"Enviando lote planilha ({len(pedaco)} chave(s))...",
                        resumo={
                            **(_job.get("resumo") or {}),
                            "fila_tamanho": len(pedaco),
                            "lotes_processados": lotes_ok,
                            "enviados_sessao": enviados_sessao,
                        },
                    )
                    qtd = _rodar_um_lote_robo(
                        organizacao_id=organizacao_id,
                        caminho_json=caminho_json,
                        caminho_planilha=None,
                        cdp=cdp,
                        acumular_itens=todos_itens,
                    )
                    lotes_ok += 1
                    enviados_sessao += qtd
            status_final = "cancelado" if _job.get("cancel_solicitado") else "ok"
            _set_job(
                status=status_final if status_final != "ok" else "ok",
                terminado_em=_agora_iso(),
                mensagem=(
                    "Parado pelo usuario."
                    if status_final == "cancelado"
                    else f"Envio concluido. Lotes={lotes_ok}."
                ),
                itens=todos_itens[-200:],
                resumo={
                    "lotes_processados": lotes_ok,
                    "enviados_sessao": enviados_sessao,
                    "limite": limite_sessao,
                    "continuo": False,
                    "tamanho_lote": TAMANHO_LOTE_PADRAO,
                },
                pid=None,
                cancel_solicitado=False,
            )
            return

        # Fonte pendentes CareCore — reserva em fatias de 100
        while True:
            with _job_lock:
                if _job.get("cancel_solicitado"):
                    break
            if restante is not None and restante <= 0:
                break

            liberar_reservas_expiradas_sync(organizacao_id)
            tamanho = TAMANHO_LOTE_PADRAO
            if restante is not None:
                tamanho = min(tamanho, restante)

            reserva = reservar_lote_cupons_sync(
                organizacao_id=organizacao_id,
                usuario_id=usuario_id,
                tamanho=tamanho,
            )
            chaves = reserva.get("chaves") or []
            lote_id = reserva.get("lote_id")
            ultimo_lote_id = lote_id
            if not chaves:
                break

            out_dir = ROBO_DIR / "_capturas"
            out_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(FUSO).strftime("%Y%m%d_%H%M%S")
            caminho_json = out_dir / f"fila_lote_{stamp}.json"
            caminho_json.write_text(
                json.dumps([{"chave": c} for c in chaves], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            _set_job(
                mensagem=(
                    f"Lote {lotes_ok + 1}: enviando {len(chaves)} cupom(ns)"
                    + (" (continuo)..." if continuo else "...")
                ),
                resumo={
                    "fila_tamanho": len(chaves),
                    "limite": limite_sessao,
                    "continuo": continuo,
                    "tamanho_lote": TAMANHO_LOTE_PADRAO,
                    "lotes_processados": lotes_ok,
                    "enviados_sessao": enviados_sessao,
                    "lote_id": lote_id,
                },
            )
            qtd = _rodar_um_lote_robo(
                organizacao_id=organizacao_id,
                caminho_json=caminho_json,
                caminho_planilha=None,
                cdp=cdp,
                acumular_itens=todos_itens,
            )
            # Libera o que ainda ficou reservado neste lote (ex.: parada no meio).
            if lote_id:
                liberar_lote_sync(organizacao_id=organizacao_id, lote_id=lote_id)
            lotes_ok += 1
            enviados_sessao += qtd
            if restante is not None:
                restante -= len(chaves)

            with _job_lock:
                if _job.get("cancel_solicitado"):
                    break
            if not continuo and restante is not None and restante <= 0:
                break
            if not continuo and limite_sessao is not None and restante is not None and restante <= 0:
                break
            # Continuo: loop pega o proximo milheiro em fatias de 100 ate acabar.

        cancelado = bool(_job.get("cancel_solicitado"))
        _set_job(
            status="cancelado" if cancelado else "ok",
            terminado_em=_agora_iso(),
            mensagem=(
                f"Parado. Lotes={lotes_ok}, processados≈{enviados_sessao}."
                if cancelado
                else f"Envio concluido. Lotes={lotes_ok}, processados≈{enviados_sessao}."
            ),
            itens=todos_itens[-200:],
            resumo={
                "lotes_processados": lotes_ok,
                "enviados_sessao": enviados_sessao,
                "limite": limite_sessao,
                "continuo": continuo,
                "tamanho_lote": TAMANHO_LOTE_PADRAO,
            },
            pid=None,
            cancel_solicitado=False,
        )
    except Exception as exc:
        if ultimo_lote_id:
            try:
                liberar_lote_sync(organizacao_id=organizacao_id, lote_id=ultimo_lote_id)
            except Exception:
                pass
        _set_job(
            status="erro",
            terminado_em=_agora_iso(),
            mensagem=str(exc),
            pid=None,
            cancel_solicitado=False,
        )
    finally:
        with _job_lock:
            _job_proc = None
        _limpar_stop_flag()


def _rodar_um_lote_robo(
    *,
    organizacao_id: str,
    caminho_json: Optional[Path],
    caminho_planilha: Optional[Path],
    cdp: str,
    acumular_itens: list[dict],
) -> int:
    """Executa um lote do robo e sincroniza status. Retorna qtd sincronizada."""
    global _job_proc
    if not ENVIAR_FILA.is_file():
        raise RuntimeError(f"Script nao encontrado: {ENVIAR_FILA}")
    cmd = [
        _python_exe(),
        str(ENVIAR_FILA),
        "--cdp",
        cdp,
        "--auto",
    ]
    if caminho_planilha:
        cmd.extend(["--planilha", str(caminho_planilha)])
    else:
        if not caminho_json or not Path(caminho_json).is_file():
            raise RuntimeError("Arquivo JSON da fila pendente nao encontrado.")
        cmd.extend(["--json", str(caminho_json)])

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    with _job_lock:
        _job_proc = proc
        _job["pid"] = proc.pid

    try:
        stdout, stderr = proc.communicate(timeout=60 * 60)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        raise RuntimeError("Timeout de 1h no envio da fila.")

    saida = (stdout or "") + ("\n" + stderr if stderr else "")
    capturas = ROBO_DIR / "_capturas"
    logs = sorted(capturas.glob("fila_resultado_*.json"), key=lambda p: p.stat().st_mtime) if capturas.is_dir() else []
    log_path = str(logs[-1]) if logs else None
    itens = []
    if log_path:
        try:
            payload = json.loads(Path(log_path).read_text(encoding="utf-8"))
            itens = payload.get("itens") or []
        except Exception:
            pass

    atualizados = 0
    try:
        atualizados = _aplicar_resultados_no_banco(None, organizacao_id, itens)
    except Exception as exc:
        saida += f"\n[aviso] falha ao sincronizar status no CareCore: {exc}"

    acumular_itens.extend(itens)
    with _job_lock:
        _job["stdout_tail"] = (saida or "")[-4000:]
        _job["log_path"] = log_path
        _job_proc = None
        _job["pid"] = None
    return atualizados


def _worker_enviar(
    *,
    organizacao_id: str,
    fonte: str,
    caminho_json: Optional[Path],
    caminho_planilha: Optional[Path],
    limite: Optional[int],
    cdp: str,
) -> None:
    """Compat: um unico lote (legado). Preferir _worker_sessao_envio."""
    global _job_proc
    try:
        itens: list[dict] = []
        _rodar_um_lote_robo(
            organizacao_id=organizacao_id,
            caminho_json=caminho_json,
            caminho_planilha=caminho_planilha if fonte == "planilha" else None,
            cdp=cdp,
            acumular_itens=itens,
        )
        if limite and itens:
            itens = itens[: int(limite)]
        cancelado = bool(_job.get("cancel_solicitado"))
        _set_job(
            status="cancelado" if cancelado else "ok",
            terminado_em=_agora_iso(),
            mensagem="Parado pelo usuario." if cancelado else "Envio concluido.",
            itens=itens[-200:],
            pid=None,
            cancel_solicitado=False,
        )
    except Exception as exc:
        _set_job(
            status="erro",
            terminado_em=_agora_iso(),
            mensagem=str(exc),
            pid=None,
            cancel_solicitado=False,
        )
    finally:
        with _job_lock:
            _job_proc = None
        _limpar_stop_flag()

