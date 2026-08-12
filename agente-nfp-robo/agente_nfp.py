#!/usr/bin/env python3
"""Agente NFP SEFAZ — Chrome local + fila/reserva no CareCore+ online.

Cada PC da Sede roda o proprio agente (independente dos outros).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

try:
    from zoneinfo import ZoneInfo

    FUSO = ZoneInfo("America/Sao_Paulo")
except Exception:
    FUSO = None  # Windows sem tzdata: usa horario local da maquina

from carecore_api import CareCoreApi, CareCoreApiError
from chrome_local import CDP_PADRAO, abrir_chrome_fazenda, status_cdp

ROOT = Path(__file__).resolve().parent
ROBO_DIR = ROOT / "robo"
ENVIAR_FILA = ROBO_DIR / "enviar_fila.py"
STOP_FLAG = ROBO_DIR / "_capturas" / "fila_parar.flag"
CONFIG_PATH = ROOT / "config.json"
TOKEN_PATH = ROOT / ".token"
TAMANHO_LOTE = 100


def _agora() -> str:
    if FUSO is not None:
        return datetime.now(FUSO).strftime("%Y-%m-%d %H:%M:%S")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _agora_stamp() -> str:
    if FUSO is not None:
        return datetime.now(FUSO).strftime("%Y%m%d_%H%M%S")
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def carregar_config_leve(path: Path = CONFIG_PATH) -> dict[str, Any]:
    """Config parcial — suficiente para abrir Chrome (sem exigir senha)."""
    cfg: dict[str, Any] = {}
    if path.is_file():
        try:
            cfg = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            cfg = {}
    api = (cfg.get("api_base_url") or "https://carecoreplus-api.fly.dev").rstrip("/")
    email = (cfg.get("email") or "").strip()
    senha = cfg.get("senha") or ""
    cdp = (cfg.get("cdp") or CDP_PADRAO).rstrip("/")
    nome_maquina = (cfg.get("nome_maquina") or os.environ.get("COMPUTERNAME") or "sede").strip()
    return {
        "api_base_url": api,
        "email": email,
        "senha": senha,
        "cdp": cdp,
        "nome_maquina": nome_maquina,
        "tamanho_lote": int(cfg.get("tamanho_lote") or TAMANHO_LOTE),
    }


def carregar_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    out = carregar_config_leve(path)
    if not _credenciais_ok(out):
        raise SystemExit(
            "Entre com e-mail e senha do CareCore no painel (usuario ADM Global ou Manutencao)."
        )
    return out


def _credenciais_ok(cfg: dict[str, Any]) -> bool:
    email = (cfg.get("email") or "").strip().lower()
    senha = cfg.get("senha") or ""
    if not email or not senha:
        return False
    if senha == "ALTERE_AQUI":
        return False
    if email.startswith("seu.usuario"):
        return False
    return True


def salvar_credenciais(
    *,
    email: str,
    senha: str,
    nome_maquina: Optional[str] = None,
    path: Path = CONFIG_PATH,
) -> dict[str, Any]:
    """Grava login digitado no painel (sem o usuario editar JSON)."""
    atual = carregar_config_leve(path)
    email_n = (email or "").strip().lower()
    senha_n = senha or ""
    if not email_n or not senha_n:
        raise ValueError("Informe e-mail e senha.")
    atual["email"] = email_n
    atual["senha"] = senha_n
    if nome_maquina is not None and str(nome_maquina).strip():
        atual["nome_maquina"] = str(nome_maquina).strip()
    if not atual.get("api_base_url"):
        atual["api_base_url"] = "https://carecoreplus-api.fly.dev"
    if not atual.get("cdp"):
        atual["cdp"] = CDP_PADRAO
    if not atual.get("tamanho_lote"):
        atual["tamanho_lote"] = TAMANHO_LOTE
    path.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return atual


def autenticar(cfg: dict[str, Any]) -> CareCoreApi:
    """Login completo (botao Entrar). Sempre gera token novo."""
    api = CareCoreApi(cfg["api_base_url"])
    print(f"[{_agora()}] Login em {cfg['api_base_url']} como {cfg['email']}...")
    api.login(cfg["email"], cfg["senha"])
    TOKEN_PATH.write_text(api.token, encoding="utf-8")
    print(f"[{_agora()}] Login ok.")
    return api


def _ler_token() -> str:
    try:
        if TOKEN_PATH.is_file():
            return TOKEN_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        pass
    return ""


def obter_api(cfg: dict[str, Any], *, forcar_login: bool = False) -> CareCoreApi:
    """Reusa token salvo; so faz login se nao houver token ou forcar_login=True.

    Evita estourar rate-limit (429) no /api/login a cada atualizacao do painel.
    """
    if not forcar_login:
        token = _ler_token()
        if token:
            return CareCoreApi(cfg["api_base_url"], token=token)
    return autenticar(cfg)


def api_com_retry_login(cfg: dict[str, Any]):
    """Retorna (api) e helper que, em 401, refaz login uma vez."""

    api = obter_api(cfg)

    def _call(fn_name: str, *args, **kwargs):
        nonlocal api
        metodo = getattr(api, fn_name)
        try:
            return metodo(*args, **kwargs)
        except CareCoreApiError as exc:
            if exc.status == 401:
                api = autenticar(cfg)
                metodo = getattr(api, fn_name)
                return metodo(*args, **kwargs)
            raise

    return api, _call


def marcar_parar() -> None:
    STOP_FLAG.parent.mkdir(parents=True, exist_ok=True)
    STOP_FLAG.write_text("1", encoding="utf-8")
    print(f"[{_agora()}] Parada solicitada (flag criada).")


def limpar_parar() -> None:
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass


def parada_solicitada() -> bool:
    return STOP_FLAG.is_file()


def rodar_enviar_fila(*, cdp: str, caminho_json: Path) -> list[dict]:
    if not ENVIAR_FILA.is_file():
        raise RuntimeError(
            "Script do robô ausente: "
            f"{ENVIAR_FILA}\n"
            "Reinstale o CareCore-Agente-NFP.exe (versão nova) ou copie a pasta robo/ "
            "para AppData\\Local\\CareCorePlus\\agente-nfp-robo\\robo\\"
        )
    cmd = [
        sys.executable,
        str(ENVIAR_FILA),
        "--cdp",
        cdp,
        "--json",
        str(caminho_json),
        "--auto",
    ]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    print(f"[{_agora()}] Robo: {caminho_json.name} ({cdp})")
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=60 * 60,
    )
    if proc.stdout:
        print(proc.stdout[-3000:])
    if proc.returncode != 0 and proc.stderr:
        print(proc.stderr[-2000:], file=sys.stderr)

    capturas = ROBO_DIR / "_capturas"
    logs = (
        sorted(capturas.glob("fila_resultado_*.json"), key=lambda p: p.stat().st_mtime)
        if capturas.is_dir()
        else []
    )
    if not logs:
        return []
    try:
        payload = json.loads(logs[-1].read_text(encoding="utf-8"))
        return list(payload.get("itens") or [])
    except Exception:
        return []


def processar_sessao(
    api: CareCoreApi,
    cfg: dict[str, Any],
    *,
    limite: Optional[int],
    continuo: bool,
) -> None:
    cdp = cfg["cdp"]
    st = status_cdp(cdp)
    if not st.get("ok"):
        raise SystemExit(
            "Chrome com depuracao (porta 9222) nao esta ativo.\n"
            "Rode abrir_chrome.bat, faca login/CAPTCHA ate Bem-vindo, e tente de novo."
        )

    limpar_parar()
    restante = int(limite) if limite is not None else None
    lotes = 0
    processados = 0
    out_dir = ROBO_DIR / "_capturas"
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        api.liberar_expirados()
    except CareCoreApiError as exc:
        print(f"[{_agora()}] Aviso liberar expirados: {exc}")

    while True:
        if parada_solicitada():
            print(f"[{_agora()}] Parado pelo operador.")
            break
        if restante is not None and restante <= 0:
            break

        tamanho = min(cfg["tamanho_lote"], restante) if restante is not None else cfg["tamanho_lote"]
        try:
            reserva = api.reservar_lote(tamanho)
        except CareCoreApiError as exc:
            raise SystemExit(f"Falha ao reservar lote: {exc}") from exc

        chaves = reserva.get("chaves") or []
        lote_id = reserva.get("lote_id")
        if not chaves:
            if continuo and restante is None:
                print(
                    f"[{_agora()}] Fila vazia — aguardando 60s por novas leituras "
                    "(modo continuo noturno). Parar no painel encerra."
                )
                for _ in range(12):
                    if parada_solicitada():
                        break
                    time.sleep(5)
                if parada_solicitada():
                    print(f"[{_agora()}] Parado pelo operador.")
                    break
                continue
            print(f"[{_agora()}] Sem pendentes na fila online.")
            break

        stamp = _agora_stamp()
        caminho_json = out_dir / f"fila_lote_{cfg['nome_maquina']}_{stamp}.json"
        caminho_json.write_text(
            json.dumps([{"chave": c} for c in chaves], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(
            f"[{_agora()}] Lote {lotes + 1}: {len(chaves)} cupom(ns)"
            + (f" id={lote_id[:8]}…" if lote_id else "")
        )

        itens: list[dict] = []
        sessao_caiu = False
        bloqueio_sefaz = False
        try:
            itens = rodar_enviar_fila(cdp=cdp, caminho_json=caminho_json)
            if itens:
                sync = api.aplicar_resultados(itens)
                print(f"[{_agora()}] Sincronizados no CareCore: {sync.get('atualizados', 0)}")
                if len(itens) < len(chaves):
                    print(
                        f"[{_agora()}] Lote parcial: {len(itens)}/{len(chaves)} processados. "
                        "Restante volta a pendente; sessao continua se ainda estiver logada."
                    )
                if any((it.get("tipo") or "") == "sessao_caiu" for it in itens):
                    sessao_caiu = True
                if any((it.get("tipo") or "") == "bloqueio_sefaz" for it in itens):
                    bloqueio_sefaz = True
        finally:
            if lote_id:
                try:
                    api.liberar_lote(lote_id)
                except CareCoreApiError as exc:
                    print(f"[{_agora()}] Aviso liberar lote: {exc}")

        lotes += 1
        processados_lote = len(itens) if itens else 0
        processados += processados_lote
        if restante is not None:
            restante -= processados_lote

        if sessao_caiu:
            print(f"[{_agora()}] Sessao NFP caiu — encerrando (login manual necessario).")
            break

        if bloqueio_sefaz:
            print(
                f"[{_agora()}] SEFAZ bloqueou doacao nesta conta "
                "(indicios de notas de terceiros) — encerrando sem retomar menu/Nova Doacao."
            )
            break

        if parada_solicitada():
            print(f"[{_agora()}] Parado pelo operador.")
            break
        if restante is not None and restante <= 0:
            break

        # Lote vazio/parcial por instabilidade de tela: espera curta e tenta o proximo.
        # Nao insistir agressivamente — se a tela falhou de verdade, o proximo lote
        # tambem falha e o operador ve no log.
        if processados_lote == 0 and chaves:
            print(
                f"[{_agora()}] Nenhum item neste lote — aguardando 15s e tentando de novo."
            )
            for _ in range(3):
                if parada_solicitada():
                    break
                time.sleep(5)
            if parada_solicitada():
                print(f"[{_agora()}] Parado pelo operador.")
                break
            if not continuo and limite is None:
                break
            continue

        # Sem --continuo e sem --limite: um unico lote.
        if not continuo and limite is None:
            break

        # Continuo com fila vazia: espera novas leituras (rotina noturna).
        if continuo and restante is None:
            # proximo ciclo do while reserva de novo; se vazio, trata abaixo
            pass

    print(f"[{_agora()}] Sessao fim. Lotes={lotes}, chaves≈{processados}.")


def cmd_status(cfg: dict[str, Any]) -> None:
    api = autenticar(cfg)
    fila = api.fila()
    cdp = status_cdp(cfg["cdp"])
    print("--- Fila online ---")
    print(json.dumps(fila, ensure_ascii=False, indent=2))
    print("--- Chrome local ---")
    print(json.dumps(cdp, ensure_ascii=False, indent=2))


def cmd_abrir_chrome(cfg: dict[str, Any]) -> None:
    out = abrir_chrome_fazenda(cfg["cdp"])
    print(out.get("mensagem") or out)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Agente NFP SEFAZ (CareCore+)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Fila online + status do Chrome local")
    sub.add_parser("abrir-chrome", help="Abre Chrome com depuracao na porta 9222")
    sub.add_parser("parar", help="Pede parada cooperativa do envio em andamento")

    p_env = sub.add_parser("enviar", help="Reserva lotes online e envia no Chrome local")
    p_env.add_argument(
        "--limite",
        type=int,
        default=None,
        help="Teto de chaves nesta sessao (ex.: 500). Sem --limite e sem --continuo = 1 lote.",
    )
    p_env.add_argument(
        "--continuo",
        action="store_true",
        help="Pega novos lotes de 100 ate acabar a fila ou Parar.",
    )

    args = parser.parse_args(argv)

    if args.cmd == "parar":
        marcar_parar()
        return 0
    if args.cmd == "abrir-chrome":
        cmd_abrir_chrome(carregar_config_leve())
        return 0

    cfg = carregar_config()
    if args.cmd == "status":
        cmd_status(cfg)
        return 0
    if args.cmd == "enviar":
        api = autenticar(cfg)
        processar_sessao(
            api,
            cfg,
            limite=args.limite,
            continuo=bool(args.continuo),
        )
        return 0
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        marcar_parar()
        print("Interrompido.")
        raise SystemExit(130)
