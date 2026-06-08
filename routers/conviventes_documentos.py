import contextlib
import os

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DocumentoConviventeDB


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
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def validar_upload_documento(file: UploadFile) -> str:
    nome_original = os.path.basename(file.filename or "")
    extensao = os.path.splitext(nome_original)[1].lower()
    content_type = (file.content_type or "").lower()

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


async def remover_documentos_foto_perfil(
    db: AsyncSession,
    convivente_id: str,
) -> None:
    documentos_foto = (
        await db.execute(
            select(DocumentoConviventeDB).where(
                DocumentoConviventeDB.convivente_id == convivente_id,
                DocumentoConviventeDB.tipo_documento == "Foto de Perfil",
            )
        )
    ).scalars().all()

    for documento in documentos_foto:
        caminho_documento = caminho_absoluto_documento(documento.caminho_arquivo)

        if (
            os.path.commonpath([UPLOAD_DIR_ABSOLUTO, caminho_documento]) == UPLOAD_DIR_ABSOLUTO
            and os.path.exists(caminho_documento)
        ):
            os.remove(caminho_documento)

        await db.delete(documento)


def caminho_absoluto_documento(caminho_arquivo: str) -> str:
    nome_arquivo = os.path.basename(caminho_arquivo or "")
    return os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo))
