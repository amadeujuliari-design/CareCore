"""API — conferência NFS-e emitidas (Finanças, uso local)."""

from __future__ import annotations

import os
import threading
from typing import Any

import asyncio

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field

from financeiro_deps import exigir_org_financeira
from financeiro_nfse_conferencia_service import (
    carregar_config,
    marcar_parar,
    registrar_inicio,
    resolver_ritmo_nfse,
    salvar_config,
    snap_job,
    validar_config,
)
from financeiro_nfse_robo import (
    abrir_navegador_sync,
    executar_conferencia_sync,
    fechar_navegador_sync,
    _playwright_disponivel,
)

router = APIRouter(
    prefix="/api/financeiro/nfse-conferencia",
    tags=["Finanças — Conferência NFS-e"],
)

_thread: threading.Thread | None = None


def _ferramenta_habilitada() -> bool:
    return os.environ.get("CARECORE_NFSE_CONFERENCIA", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _exigir_local() -> None:
    if not _ferramenta_habilitada():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conferência NFS-e disponível apenas no ambiente local.",
        )


class ConfigPayload(BaseModel):
    pastas_origem: list[str] = Field(default_factory=list)
    pasta_destino: str = ""
    ano: int = 2026
    mes_inicio: int = 1
    mes_fim: int = 12
    ritmo: str = "lento"


class EscolherPastaPayload(BaseModel):
    titulo: str = "Selecione uma pasta"


@router.post("/pastas/escolher")
async def escolher_pasta_explorer(
    payload: EscolherPastaPayload | None = None,
    usuario: dict = Depends(exigir_org_financeira),
):
    _exigir_local()
    from financeiro_pasta_dialog import escolher_pasta_windows

    titulo = (payload.titulo if payload else None) or "Selecione uma pasta"
    try:
        caminho = await asyncio.to_thread(escolher_pasta_windows, titulo)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Não foi possível abrir o Explorer: {exc}",
        ) from exc

    if not caminho:
        return {"cancelado": True, "caminho": None}
    return {"cancelado": False, "caminho": caminho}


@router.get("/config")
async def obter_config(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    org_id = str(usuario["organizacao_id"])
    return carregar_config(org_id)


@router.put("/config")
async def gravar_config(
    payload: ConfigPayload,
    usuario: dict = Depends(exigir_org_financeira),
):
    _exigir_local()
    org_id = str(usuario["organizacao_id"])
    config = salvar_config(org_id, payload.model_dump())
    try:
        if config.get("pastas_origem") and config.get("pasta_destino"):
            validar_config(config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return config


@router.get("/status")
async def status_job(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    job = snap_job()
    job["playwright_instalado"] = _playwright_disponivel()
    return job


@router.post("/navegador/abrir")
async def abrir_navegador(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    global _thread
    job = snap_job()
    if job.get("status") in {"executando", "preparando"}:
        raise HTTPException(status_code=409, detail="Conferência em execução.")

    def _run() -> None:
        org_id = str(usuario["organizacao_id"])
        params = resolver_ritmo_nfse(carregar_config(org_id))
        abrir_navegador_sync(slow_mo_ms=int(params.get("slow_mo_ms") or 200))

    _thread = threading.Thread(target=_run, daemon=True)
    _thread.start()
    return {"ok": True}


@router.post("/iniciar")
async def iniciar_conferencia(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    global _thread
    job = snap_job()
    if job.get("status") in {"executando", "preparando"}:
        raise HTTPException(status_code=409, detail="Conferência já em execução.")

    org_id = str(usuario["organizacao_id"])
    try:
        config = registrar_inicio(org_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def _run() -> None:
        executar_conferencia_sync(config)

    _thread = threading.Thread(target=_run, daemon=True)
    _thread.start()
    return {"ok": True}


@router.post("/parar")
async def parar_conferencia(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    marcar_parar()
    return {"ok": True}


@router.post("/navegador/fechar")
async def fechar_navegador(usuario: dict = Depends(exigir_org_financeira)):
    _exigir_local()
    fechar_navegador_sync()
    return {"ok": True}
