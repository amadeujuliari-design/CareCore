# =====================================================================
# ARQUIVO: routers/arquivos.py
# Servir uploads apenas para usuário autenticado (sem URL pública).
# =====================================================================

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ConviventeDB, DocumentoConviventeDB, InstituicaoDB
from security import get_usuario_logado, usuario_eh_gestor
from storage_uploads import (
    StorageErro,
    baixar_supabase_storage,
    extrair_bucket_caminho_storage,
    storage_supabase_configurado,
)

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


async def obter_documento_do_upload(
    relative_path: str,
    instituicao_id: str,
    db: AsyncSession,
):
    caminhos = candidatos_caminho_upload(relative_path)

    resultado_documento = await db.execute(
        select(DocumentoConviventeDB)
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

    return resultado_documento.scalar_one_or_none()


async def arquivo_pertence_a_instituicao(
    relative_path: str,
    instituicao_id: str,
    db: AsyncSession,
) -> bool:
    documento = await obter_documento_do_upload(relative_path, instituicao_id, db)

    if documento is not None:
        return True

    caminhos = candidatos_caminho_upload(relative_path)

    resultado_logo_relatorio = await db.execute(
        select(InstituicaoDB.id)
        .where(
            InstituicaoDB.id == instituicao_id,
            InstituicaoDB.relatorio_logo_url.in_(caminhos),
        )
        .limit(1)
    )

    if resultado_logo_relatorio.scalar_one_or_none() is not None:
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

    documento = await obter_documento_do_upload(
        relative_path=caminho_normalizado,
        instituicao_id=usuario_atual["instituicao_id"],
        db=db,
    )

    if documento and documento.sensivel and not usuario_eh_gestor(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    if documento is None:
        caminhos = candidatos_caminho_upload(caminho_normalizado)

        resultado_logo_relatorio = await db.execute(
            select(InstituicaoDB.id)
            .where(
                InstituicaoDB.id == usuario_atual["instituicao_id"],
                InstituicaoDB.relatorio_logo_url.in_(caminhos),
            )
            .limit(1)
        )

        if resultado_logo_relatorio.scalar_one_or_none() is not None:
            autorizado = True
        else:
            resultado_foto = await db.execute(
                select(ConviventeDB.id)
                .where(
                    ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
                    ConviventeDB.foto_url.in_(caminhos),
                )
                .limit(1)
            )

            autorizado = resultado_foto.scalar_one_or_none() is not None
    else:
        autorizado = True

    if not autorizado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado.",
        )

    storage_ref = extrair_bucket_caminho_storage(caminho_normalizado)
    if storage_ref is not None:
        if not storage_supabase_configurado():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Arquivo não encontrado.",
            )

        bucket, caminho_storage = storage_ref
        try:
            arquivo = baixar_supabase_storage(bucket, caminho_storage)
        except StorageErro as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Arquivo não encontrado.",
            ) from exc

        return Response(
            content=arquivo.conteudo,
            media_type=arquivo.content_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": f'inline; filename="{Path(caminho_storage).name}"',
            },
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
        headers={
            "Cache-Control": "private, max-age=86400",
        },
    )
