# =====================================================================
# ARQUIVO: routers/arquivos.py
# Servir uploads apenas para usuário autenticado (sem URL pública).
# =====================================================================

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ConviventeDB, DocumentoConviventeDB
from security import get_usuario_logado

router = APIRouter(prefix="/api", tags=["Arquivos"])

# Raiz do projeto (pasta acima de routers/)
_PROJETO_ROOT = Path(__file__).resolve().parent.parent
_UPLOADS_ROOT = (_PROJETO_ROOT / "uploads").resolve()


def candidatos_caminho_upload(relative_path: str) -> list[str]:
    caminho = relative_path.strip().replace("\\", "/").lstrip("/")

    if caminho.startswith("uploads/"):
        caminho = caminho[len("uploads/"):]

    return [
        f"/uploads/{caminho}",
        f"uploads/{caminho}",
        caminho,
        f"/{caminho}",
    ]


async def arquivo_pertence_a_instituicao(
    relative_path: str,
    instituicao_id: str,
    db: AsyncSession,
) -> bool:
    caminhos = candidatos_caminho_upload(relative_path)

    resultado_documento = await db.execute(
        select(DocumentoConviventeDB.id)
        .join(
            ConviventeDB,
            ConviventeDB.id == DocumentoConviventeDB.convivente_id,
        )
        .where(
            ConviventeDB.instituicao_id == instituicao_id,
            DocumentoConviventeDB.caminho_arquivo.in_(caminhos),
        )
        .limit(1)
    )

    if resultado_documento.scalar_one_or_none() is not None:
        return True

    resultado_foto = await db.execute(
        select(ConviventeDB.id)
        .where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.foto_url.in_(caminhos),
        )
        .limit(1)
    )

    return resultado_foto.scalar_one_or_none() is not None


@router.get("/arquivos/{relative_path:path}")
async def servir_arquivo_upload(
    relative_path: str,
    usuario_atual: dict = Depends(get_usuario_logado),
    db: AsyncSession = Depends(get_db),
):
    caminho_normalizado = relative_path.strip().replace("\\", "/").lstrip("/")

    if not caminho_normalizado or ".." in caminho_normalizado.split("/"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    if caminho_normalizado.startswith("uploads/"):
        caminho_normalizado = caminho_normalizado[len("uploads/"):]

    autorizado = await arquivo_pertence_a_instituicao(
        relative_path=caminho_normalizado,
        instituicao_id=usuario_atual["instituicao_id"],
        db=db,
    )

    if not autorizado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    candidato = (_UPLOADS_ROOT / caminho_normalizado).resolve()

    try:
        candidato.relative_to(_UPLOADS_ROOT)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    if not candidato.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    return FileResponse(
        path=candidato,
        filename=candidato.name,
    )
