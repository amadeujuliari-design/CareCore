"""Testes do carimbo de assinatura em posição escolhida no PDF."""

from __future__ import annotations

import io

import pytest
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from PIL import Image, ImageDraw

from compras_assinatura_pdf import (
    carimbar_assinatura_pdf,
    carimbar_assinatura_no_rodape_pdf,
    _rgba_fundo_transparente,
)


def _pdf_paginas(n: int = 1, width: float = 400.0, height: float = 600.0) -> bytes:
    from pypdf import PdfWriter
    from pypdf.generic import RectangleObject

    writer = PdfWriter()
    for _ in range(n):
        page = writer.add_blank_page(width=width, height=height)
        page.mediabox = RectangleObject((0, 0, width, height))
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _pdf_assinatura_com_imagem() -> bytes:
    """PDF de assinatura com imagem RGB (fundo branco + traço azul)."""
    img = Image.new("RGB", (400, 120), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.line((20, 80, 180, 40), fill=(20, 60, 180), width=4)
    draw.ellipse((200, 30, 280, 90), outline=(20, 60, 180), width=3)
    png = io.BytesIO()
    img.save(png, format="PNG")
    png.seek(0)

    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=(400, 120))
    c.drawImage(ImageReader(png), 0, 0, width=400, height=120)
    c.save()
    return buf.getvalue()


def test_rgba_fundo_transparente_remove_branco():
    img = Image.new("RGB", (4, 2), (255, 255, 255))
    img.putpixel((0, 0), (10, 40, 160))
    out = _rgba_fundo_transparente(img)
    assert out.getpixel((1, 1))[3] == 0
    assert out.getpixel((0, 0))[3] > 100


def test_carimbar_rodape_ultima_pagina_sem_coords():
    orc = _pdf_paginas(2)
    sig = _pdf_assinatura_com_imagem()
    out = carimbar_assinatura_no_rodape_pdf(orcamento_bytes=orc, assinatura_bytes=sig)
    from pypdf import PdfReader

    leitor = PdfReader(io.BytesIO(out))
    assert len(leitor.pages) == 2


def test_carimbar_posicao_pagina_escolhida():
    orc = _pdf_paginas(3, width=500, height=700)
    sig = _pdf_assinatura_com_imagem()
    out = carimbar_assinatura_pdf(
        orcamento_bytes=orc,
        assinatura_bytes=sig,
        page_index=1,
        x=40.0,
        y=80.0,
        width=180.0,
        height=50.0,
    )
    from pypdf import PdfReader

    leitor = PdfReader(io.BytesIO(out))
    assert len(leitor.pages) == 3


def test_carimbar_pagina_invalida():
    orc = _pdf_paginas(1)
    sig = _pdf_assinatura_com_imagem()
    with pytest.raises(ValueError, match="Página inválida"):
        carimbar_assinatura_pdf(
            orcamento_bytes=orc,
            assinatura_bytes=sig,
            page_index=5,
            x=10,
            y=10,
            width=50,
            height=20,
        )
