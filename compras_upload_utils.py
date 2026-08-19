"""Upload de arquivos do módulo Compras (orçamentos, NF, respostas)."""

from __future__ import annotations

import os
import uuid

from fastapi import HTTPException, UploadFile

from storage_uploads import (
    StorageErro,
    storage_supabase_configurado,
    upload_supabase_storage,
)

UPLOAD_DIR = "uploads/compras"
os.makedirs(UPLOAD_DIR, exist_ok=True)
UPLOAD_DIR_ABSOLUTO = os.path.abspath(UPLOAD_DIR)
TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024
EXTENSOES_PERMITIDAS = {
    ".pdf",
    ".xml",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".html",
    ".htm",
}
CONTENT_TYPES_PERMITIDOS = {
    "application/pdf",
    "application/xml",
    "text/xml",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/html",
    "application/octet-stream",
}
_AMBIENTES_LOCAL = {"local", "development", "dev", "test", "testing"}


def upload_local_permitido() -> bool:
    return os.getenv("APP_ENV", "local").strip().lower() in _AMBIENTES_LOCAL


def validar_upload_compras(file: UploadFile) -> tuple[str, str]:
    nome = os.path.basename(file.filename or "arquivo")
    ext = os.path.splitext(nome)[1].lower()
    if ext not in EXTENSOES_PERMITIDAS:
        raise HTTPException(
            status_code=400,
            detail="Formato não permitido. Use PDF, XML ou imagem (JPG/PNG).",
        )
    content_type = (file.content_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    if content_type not in CONTENT_TYPES_PERMITIDOS:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não permitido.")
    return nome, ext


async def salvar_arquivo_compras(
    *,
    organizacao_id: str,
    pedido_id: str,
    file: UploadFile,
    conteudo: bytes,
) -> tuple[str, str, int]:
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede 15 MB.")
    nome_original, ext = validar_upload_compras(file)
    nome_unico = f"{uuid.uuid4().hex}{ext}"
    relativo = f"compras/{organizacao_id}/{pedido_id}/{nome_unico}"
    content_type = (file.content_type or "application/octet-stream").split(";", 1)[0].strip()

    if storage_supabase_configurado():
        try:
            caminho = upload_supabase_storage(
                relativo,
                conteudo,
                content_type=content_type,
            )
            return caminho, nome_original, len(conteudo)
        except StorageErro as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not upload_local_permitido():
        raise HTTPException(status_code=503, detail="Armazenamento de arquivos indisponível.")

    destino_dir = os.path.join(UPLOAD_DIR, organizacao_id, pedido_id)
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, nome_unico)
    with open(destino, "wb") as handle:
        handle.write(conteudo)
    caminho = f"/uploads/{relativo.replace(os.sep, '/')}"
    return caminho, nome_original, len(conteudo)
