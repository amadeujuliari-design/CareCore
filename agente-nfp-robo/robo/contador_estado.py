#!/usr/bin/env python3
"""Estado vivo do contador de envio NFP (lido pelo HUD flutuante)."""

from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

try:
    from zoneinfo import ZoneInfo

    FUSO = ZoneInfo("America/Sao_Paulo")
except Exception:
    FUSO = None

_LOCK = threading.Lock()
CONTADOR_PATH = Path(__file__).resolve().parent / "_capturas" / "contador_vivo.json"

TIPOS = (
    "sucesso",
    "ja_existe",
    "erro",
    "inconclusivo",
    "sessao_caiu",
    "bloqueio_sefaz",
)
STATUS = ("enviado", "rejeitado_prazo", "erro", "pendente")


def _agora() -> str:
    if FUSO is not None:
        return datetime.now(FUSO).strftime("%Y-%m-%d %H:%M:%S")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _vazio(*, ativo: bool = False, mensagem: str = "") -> dict[str, Any]:
    return {
        "atualizado_em": _agora(),
        "ativo": ativo,
        "mensagem": mensagem,
        "total": 0,
        "por_tipo": {k: 0 for k in TIPOS},
        "por_status": {k: 0 for k in STATUS},
        "ultimo": None,
    }


def resetar(*, mensagem: str = "Aguardando envios...") -> dict[str, Any]:
    estado = _vazio(ativo=True, mensagem=mensagem)
    salvar(estado)
    return estado


def salvar(estado: dict[str, Any]) -> None:
    path = CONTADOR_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    payload = dict(estado)
    payload["atualizado_em"] = _agora()
    raw = json.dumps(payload, ensure_ascii=False, indent=2)
    with _LOCK:
        tmp.write_text(raw, encoding="utf-8")
        tmp.replace(path)


def ler() -> dict[str, Any]:
    path = CONTADOR_PATH
    if not path.is_file():
        return _vazio()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _vazio()
        return data
    except Exception:
        return _vazio()


def registrar_item(
    *,
    tipo: str,
    status_carecore: str,
    mensagem: str = "",
    chave: str = "",
) -> dict[str, Any]:
    """Incrementa contadores apos cada cupom processado."""
    with _LOCK:
        estado = ler()
        if not estado.get("por_tipo"):
            estado = _vazio(ativo=True)
        estado["ativo"] = True
        estado["total"] = int(estado.get("total") or 0) + 1
        por_tipo = dict(estado.get("por_tipo") or {})
        for k in TIPOS:
            por_tipo.setdefault(k, 0)
        t = (tipo or "inconclusivo").strip()
        if t not in por_tipo:
            por_tipo[t] = 0
        por_tipo[t] = int(por_tipo.get(t) or 0) + 1
        estado["por_tipo"] = por_tipo

        por_status = dict(estado.get("por_status") or {})
        for k in STATUS:
            por_status.setdefault(k, 0)
        st = (status_carecore or "pendente").strip()
        if st not in por_status:
            por_status[st] = 0
        por_status[st] = int(por_status.get(st) or 0) + 1
        estado["por_status"] = por_status

        estado["ultimo"] = {
            "tipo": t,
            "status_carecore": st,
            "mensagem": (mensagem or "")[:180],
            "chave": (chave or "")[:44],
        }
        estado["mensagem"] = f"Ultimo: {t} → {st}"
        estado["atualizado_em"] = _agora()

        path = CONTADOR_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        raw = json.dumps(estado, ensure_ascii=False, indent=2)
        tmp.write_text(raw, encoding="utf-8")
        tmp.replace(path)
        return estado


def marcar_fim(*, mensagem: str = "Sessao encerrada.") -> None:
    estado = ler()
    estado["ativo"] = False
    estado["mensagem"] = mensagem
    salvar(estado)


def resumo_exibicao(estado: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Números prontos para o painel e para o HUD."""
    e = estado if isinstance(estado, dict) else ler()
    pt = e.get("por_tipo") or {}
    ps = e.get("por_status") or {}
    sucesso = int(pt.get("sucesso") or 0)
    ja = int(pt.get("ja_existe") or 0)
    enviados = int(ps.get("enviado") or (sucesso + ja))
    prazo = int(ps.get("rejeitado_prazo") or 0)
    erros_status = int(ps.get("erro") or 0)
    inconclusivo = int(pt.get("inconclusivo") or 0)
    sessao = int(pt.get("sessao_caiu") or 0)
    bloqueio = int(pt.get("bloqueio_sefaz") or 0)
    return {
        "ativo": bool(e.get("ativo")),
        "mensagem": e.get("mensagem") or "",
        "atualizado_em": e.get("atualizado_em") or "",
        "enviados": enviados,
        "novos": sucesso,
        "ja_existe": ja,
        "prazo": prazo,
        "erros": erros_status + sessao + bloqueio,
        "inconclusivo": inconclusivo,
        "total": int(e.get("total") or 0),
        "ultimo": e.get("ultimo") or None,
    }


def tkinter_disponivel() -> bool:
    try:
        import tkinter  # noqa: F401

        return True
    except Exception:
        return False


def abrir_hud() -> Optional[int]:
    """Abre o HUD flutuante em processo separado. Retorna PID ou None."""
    import os
    import subprocess
    import sys

    if not tkinter_disponivel():
        return None

    hud = Path(__file__).resolve().parent.parent / "contador_hud.py"
    if not hud.is_file():
        return None
    creationflags = 0
    if sys.platform == "win32":
        # Sem console extra; janela Tk aparece normalmente.
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    proc = subprocess.Popen(
        [sys.executable, str(hud)],
        cwd=str(hud.parent),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creationflags,
        env=os.environ.copy(),
    )
    return proc.pid
