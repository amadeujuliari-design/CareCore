"""Upload de arquivos do módulo Compras (orçamentos, NF, respostas)."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from imagem_upload import eh_arquivo_imagem, padronizar_imagem_documento_bytes
from storage_uploads import (
    StorageErro,
    extrair_bucket_caminho_storage,
    remover_supabase_storage,
    storage_supabase_configurado,
    upload_supabase_storage,
)

_ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = str(_ROOT / "uploads" / "compras")
os.makedirs(UPLOAD_DIR, exist_ok=True)
UPLOAD_DIR_ABSOLUTO = os.path.abspath(UPLOAD_DIR)
_ROOT_UPLOADS_ABSOLUTO = os.path.abspath(str(_ROOT / "uploads"))
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


def _caminho_local_absoluto(caminho_arquivo: str) -> Path | None:
    rel = (caminho_arquivo or "").strip().replace("\\", "/")
    if not rel:
        return None
    if rel.startswith("/uploads/"):
        rel = rel[len("/uploads/") :]
    elif rel.startswith("uploads/"):
        rel = rel[len("uploads/") :]
    alvo = (_ROOT / "uploads" / rel).resolve()
    try:
        if os.path.commonpath([_ROOT_UPLOADS_ABSOLUTO, str(alvo)]) != _ROOT_UPLOADS_ABSOLUTO:
            return None
    except ValueError:
        return None
    return alvo


def remover_arquivo_compras(caminho_arquivo: str | None) -> None:
    """Remove o blob do Storage (ou disco local). Falha silenciosa para não bloquear o fluxo."""
    if not caminho_arquivo:
        return

    storage_ref = extrair_bucket_caminho_storage(caminho_arquivo.lstrip("/"))
    if storage_ref and storage_supabase_configurado():
        bucket, rel = storage_ref
        try:
            remover_supabase_storage(bucket, rel)
        except StorageErro:
            pass
        return

    alvo = _caminho_local_absoluto(caminho_arquivo)
    if alvo and alvo.is_file():
        try:
            alvo.unlink()
        except OSError:
            pass


async def salvar_arquivo_compras(
    *,
    organizacao_id: str,
    pedido_id: str,
    file: UploadFile,
    conteudo: bytes,
) -> tuple[str, str, int, str]:
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede 15 MB.")
    nome_original, ext = validar_upload_compras(file)
    content_type = (file.content_type or "application/octet-stream").split(";", 1)[0].strip()
    nome_gravado = nome_original

    if eh_arquivo_imagem(nome_original, file.content_type):
        try:
            conteudo = padronizar_imagem_documento_bytes(conteudo)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível processar a imagem enviada.",
            ) from exc
        ext = ".jpg"
        content_type = "image/jpeg"
        nome_base = os.path.splitext(nome_original)[0] or "arquivo"
        nome_gravado = f"{nome_base}.jpg"
        if len(conteudo) > TAMANHO_MAXIMO_BYTES:
            raise HTTPException(status_code=400, detail="Arquivo excede 15 MB.")

    nome_unico = f"{uuid.uuid4().hex}{ext}"
    relativo = f"compras/{organizacao_id}/{pedido_id}/{nome_unico}"

    if storage_supabase_configurado():
        try:
            caminho = upload_supabase_storage(
                relativo,
                conteudo,
                content_type=content_type,
            )
            return caminho, nome_gravado, len(conteudo), content_type
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
    return caminho, nome_gravado, len(conteudo), content_type
