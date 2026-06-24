import contextlib
import os
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DocumentoConviventeDB
from storage_uploads import (
    StorageErro,
    extrair_bucket_caminho_storage,
    remover_supabase_storage,
    storage_supabase_configurado,
    upload_supabase_storage,
)


UPLOAD_DIR = "uploads/documentos"
os.makedirs(UPLOAD_DIR, exist_ok=True)
UPLOAD_DIR_ABSOLUTO = os.path.abspath(UPLOAD_DIR)
TAMANHO_MAXIMO_DOCUMENTO_BYTES = 10 * 1024 * 1024
EXTENSOES_DOCUMENTO_PERMITIDAS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".html",
    ".htm",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}
CONTENT_TYPES_DOCUMENTO_PERMITIDOS = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_AMBIENTES_COM_UPLOAD_LOCAL = {"local", "development", "dev", "test", "testing"}
_CONTENT_TYPES_POR_EXTENSAO = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

TIPO_DOCUMENTO_TERMO_BAGAGEIRO = "Termo do bagageiro"


def upload_local_documentos_permitido() -> bool:
    app_env = os.getenv("APP_ENV", "local").strip().lower()
    return app_env in _AMBIENTES_COM_UPLOAD_LOCAL


def content_type_documento(extensao: str, content_type: str | None = None) -> str:
    if content_type:
        return content_type
    return _CONTENT_TYPES_POR_EXTENSAO.get(extensao.lower(), "application/octet-stream")


def validar_upload_documento(file: UploadFile) -> str:
    nome_original = os.path.basename(file.filename or "")
    extensao = os.path.splitext(nome_original)[1].lower()
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()

    if not nome_original or extensao not in EXTENSOES_DOCUMENTO_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de arquivo não permitido.",
        )

    if content_type and content_type not in CONTENT_TYPES_DOCUMENTO_PERMITIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo não permitido.",
        )

    return nome_original


async def salvar_upload_documento(file: UploadFile, caminho_completo: str) -> None:
    tamanho_total = 0

    with open(caminho_completo, "wb") as buffer:
        while True:
            bloco = await file.read(1024 * 1024)

            if not bloco:
                break

            tamanho_total += len(bloco)

            if tamanho_total > TAMANHO_MAXIMO_DOCUMENTO_BYTES:
                buffer.close()
                with contextlib.suppress(FileNotFoundError):
                    os.remove(caminho_completo)

                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Arquivo muito grande. O limite é 10 MB.",
                )

            buffer.write(bloco)


def salvar_conteudo_documento_convivente(
    *,
    instituicao_id: str,
    convivente_id: str,
    extensao_final: str,
    conteudo: bytes,
    content_type: str | None = None,
) -> str:
    nome_unico = f"{uuid.uuid4().hex}{extensao_final}"
    mime = content_type_documento(extensao_final, content_type)

    if storage_supabase_configurado():
        try:
            return upload_supabase_storage(
                f"documentos/{instituicao_id}/{convivente_id}/{nome_unico}",
                conteudo,
                content_type=mime,
            )
        except StorageErro as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível salvar o arquivo no storage persistente.",
            ) from exc

    if not upload_local_documentos_permitido():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Storage persistente não configurado para documentos. "
                "Configure CARECORE_SUPABASE_URL e CARECORE_SUPABASE_SERVICE_ROLE_KEY no backend."
            ),
        )

    caminho_completo = os.path.join(UPLOAD_DIR, nome_unico)
    with open(caminho_completo, "wb") as buffer:
        buffer.write(conteudo)

    return f"/uploads/documentos/{nome_unico}"


def remover_arquivo_documento(caminho_arquivo: str | None) -> None:
    if not caminho_arquivo:
        return

    storage_ref = extrair_bucket_caminho_storage(caminho_arquivo)
    if storage_ref and storage_supabase_configurado():
        bucket, caminho = storage_ref
        try:
            remover_supabase_storage(bucket, caminho)
        except StorageErro:
            pass
        return

    caminho_documento = caminho_absoluto_documento(caminho_arquivo)
    if (
        os.path.commonpath([UPLOAD_DIR_ABSOLUTO, caminho_documento]) == UPLOAD_DIR_ABSOLUTO
        and os.path.exists(caminho_documento)
    ):
        os.remove(caminho_documento)


async def remover_documentos_foto_perfil(
    db: AsyncSession,
    convivente_id: str,
) -> None:
    await remover_documentos_por_tipo(db, convivente_id, "Foto de Perfil")


async def remover_documentos_por_tipo(
    db: AsyncSession,
    convivente_id: str,
    tipo_documento: str,
) -> None:
    documentos = (
        await db.execute(
            select(DocumentoConviventeDB).where(
                DocumentoConviventeDB.convivente_id == convivente_id,
                DocumentoConviventeDB.tipo_documento == tipo_documento,
            )
        )
    ).scalars().all()

    for documento in documentos:
        remover_arquivo_documento(documento.caminho_arquivo)
        await db.delete(documento)


async def salvar_termo_bagageiro_no_ged(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    nome_arquivo: str,
    conteudo: bytes,
    content_type: str | None = None,
) -> DocumentoConviventeDB:
    await remover_documentos_por_tipo(db, convivente_id, TIPO_DOCUMENTO_TERMO_BAGAGEIRO)

    extensao_final = os.path.splitext(nome_arquivo)[1].lower() or ".html"
    caminho_relativo = salvar_conteudo_documento_convivente(
        instituicao_id=instituicao_id,
        convivente_id=convivente_id,
        extensao_final=extensao_final,
        conteudo=conteudo,
        content_type=content_type,
    )

    novo_doc = DocumentoConviventeDB(
        convivente_id=convivente_id,
        nome_arquivo=nome_arquivo,
        caminho_arquivo=caminho_relativo,
        tipo_documento=TIPO_DOCUMENTO_TERMO_BAGAGEIRO,
        sensivel=False,
    )
    db.add(novo_doc)
    await db.flush()
    return novo_doc


async def buscar_documento_termo_bagageiro_ged(
    db: AsyncSession,
    convivente_id: str,
) -> DocumentoConviventeDB | None:
    return (
        await db.execute(
            select(DocumentoConviventeDB)
            .where(
                DocumentoConviventeDB.convivente_id == convivente_id,
                DocumentoConviventeDB.tipo_documento == TIPO_DOCUMENTO_TERMO_BAGAGEIRO,
            )
            .order_by(DocumentoConviventeDB.data_upload.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


def caminho_absoluto_documento(caminho_arquivo: str) -> str:
    nome_arquivo = os.path.basename(caminho_arquivo or "")
    return os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo))
