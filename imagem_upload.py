# Padronização de imagens enviadas ao CareCore+ (foto de perfil e scans em imagem).

from __future__ import annotations

import os
from io import BytesIO

from PIL import Image, ImageOps

JPEG_QUALITY = 85
FOTO_PERFIL_TAMANHO = 512
DOCUMENTO_IMAGEM_LADO_MAX = 2048
LOGO_RELATORIO_TAMANHO_MAX = (1200, 500)

EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".webp"}


def eh_arquivo_imagem(nome_arquivo: str, content_type: str | None) -> bool:
    extensao = os.path.splitext(nome_arquivo or "")[1].lower()

    if extensao in EXTENSOES_IMAGEM:
        return True

    return bool(content_type and content_type.lower().startswith("image/"))


def _salvar_jpeg(img: Image.Image, qualidade: int = JPEG_QUALITY) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=qualidade, optimize=True)
    return buffer.getvalue()


def _salvar_png(img: Image.Image) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def padronizar_foto_perfil_bytes(conteudo: bytes) -> bytes:
    with Image.open(BytesIO(conteudo)) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")

        largura, altura = img.size
        lado = min(largura, altura)
        esquerda = (largura - lado) // 2
        topo = (altura - lado) // 2

        img = img.crop((esquerda, topo, esquerda + lado, topo + lado))
        img = img.resize(
            (FOTO_PERFIL_TAMANHO, FOTO_PERFIL_TAMANHO),
            Image.Resampling.LANCZOS,
        )

        return _salvar_jpeg(img)


def padronizar_imagem_documento_bytes(conteudo: bytes) -> bytes:
    with Image.open(BytesIO(conteudo)) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail(
            (DOCUMENTO_IMAGEM_LADO_MAX, DOCUMENTO_IMAGEM_LADO_MAX),
            Image.Resampling.LANCZOS,
        )

        return _salvar_jpeg(img)


def padronizar_logo_relatorio_bytes(conteudo: bytes) -> bytes:
    with Image.open(BytesIO(conteudo)) as img:
        img = ImageOps.exif_transpose(img)
        tem_transparencia = img.mode in ("RGBA", "LA") or "transparency" in img.info

        if tem_transparencia:
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        img.thumbnail(LOGO_RELATORIO_TAMANHO_MAX, Image.Resampling.LANCZOS)

        if tem_transparencia:
            return _salvar_png(img)

        return _salvar_jpeg(img, qualidade=90)


def padronizar_upload_imagem(
    conteudo: bytes,
    *,
    tipo_documento: str,
) -> tuple[bytes, str]:
    """
    Retorna bytes padronizados e extensão final (.jpg para imagens processadas).
    """
    if tipo_documento == "Foto de Perfil":
        return padronizar_foto_perfil_bytes(conteudo), ".jpg"

    if tipo_documento == "Logo de Relatório":
        padronizado = padronizar_logo_relatorio_bytes(conteudo)
        extensao = ".png" if padronizado.startswith(b"\x89PNG") else ".jpg"
        return padronizado, extensao

    return padronizar_imagem_documento_bytes(conteudo), ".jpg"
