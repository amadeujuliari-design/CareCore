"""
Migra documentos de conviventes do disco local (/uploads/documentos) para Supabase Storage.

Uso em producao (Fly SSH):
  python scripts/migrar_documentos_conviventes_storage.py
  python scripts/migrar_documentos_conviventes_storage.py --yes
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from models import ConviventeDB, DocumentoConviventeDB
from routers.conviventes_documentos import UPLOAD_DIR, caminho_absoluto_documento
from storage_uploads import (
    StorageErro,
    storage_supabase_configurado,
    upload_supabase_storage,
)
from routers.conviventes_documentos import content_type_documento


def norm_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def caminho_eh_local(caminho: str | None) -> bool:
    valor = (caminho or "").strip().replace("\\", "/")
    return valor.startswith(("/uploads/documentos/", "uploads/documentos/"))


async def migrar(sessao: AsyncSession, aplicar: bool) -> dict:
    if not storage_supabase_configurado():
        raise RuntimeError("Supabase Storage não configurado neste ambiente.")

    documentos = (
        await sessao.execute(
            select(
                DocumentoConviventeDB,
                ConviventeDB.instituicao_id,
            ).join(
                ConviventeDB,
                ConviventeDB.id == DocumentoConviventeDB.convivente_id,
            )
        )
    ).all()

    stats = {
        "total_documentos": len(documentos),
        "candidatos_local": 0,
        "arquivo_ausente": 0,
        "migrados": 0,
        "fotos_atualizadas": 0,
        "erros": [],
    }

    for documento, instituicao_id in documentos:
        if not caminho_eh_local(documento.caminho_arquivo):
            continue

        stats["candidatos_local"] += 1
        caminho_abs = caminho_absoluto_documento(documento.caminho_arquivo)
        if not Path(caminho_abs).is_file():
            stats["arquivo_ausente"] += 1
            continue

        extensao = Path(caminho_abs).suffix.lower()
        conteudo = Path(caminho_abs).read_bytes()
        mime = content_type_documento(extensao)

        if not aplicar:
            stats["migrados"] += 1
            continue

        try:
            novo_caminho = upload_supabase_storage(
                f"documentos/{instituicao_id}/{documento.convivente_id}/{Path(caminho_abs).name}",
                conteudo,
                content_type=mime,
            )
        except StorageErro as exc:
            stats["erros"].append({
                "documento_id": documento.id,
                "erro": str(exc),
            })
            continue

        documento.caminho_arquivo = novo_caminho

        convivente = (
            await sessao.execute(
                select(ConviventeDB).where(ConviventeDB.id == documento.convivente_id)
            )
        ).scalar_one_or_none()

        if (
            convivente
            and documento.tipo_documento == "Foto de Perfil"
            and caminho_eh_local(convivente.foto_url)
            and os.path.basename(convivente.foto_url or "") == Path(caminho_abs).name
        ):
            convivente.foto_url = novo_caminho
            stats["fotos_atualizadas"] += 1

        stats["migrados"] += 1

    if aplicar:
        await sessao.commit()

    return stats


async def main() -> int:
    parser = argparse.ArgumentParser(description="Migra documentos locais para Supabase Storage")
    parser.add_argument("--yes", action="store_true", help="Aplicar migração (sem isso, dry-run)")
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL não configurada.", file=sys.stderr)
        return 1

    engine = create_async_engine(norm_url(database_url))
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as sessao:
        stats = await migrar(sessao, aplicar=args.yes)

    print(json.dumps({
        "modo": "aplicado" if args.yes else "dry-run",
        "upload_dir": UPLOAD_DIR,
        **stats,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
