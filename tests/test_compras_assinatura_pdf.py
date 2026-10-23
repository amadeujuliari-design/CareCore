"""Testes do carimbo de assinatura em posição escolhida no PDF."""

from __future__ import annotations

import io

import pytest
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from PIL import Image, ImageDraw

from compras_assinatura_pdf import (
    carimbar_assinatura_gestor_pdf,
    carimbar_assinatura_pdf,
    carimbar_assinatura_no_rodape_pdf,
    carimbar_texto_pdf,
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


def test_carimbar_assinatura_gestor_no_pdf():
    from pypdf import PdfReader

    origem = _pdf_paginas(1, width=500.0, height=700.0)
    saida = carimbar_assinatura_gestor_pdf(
        pdf_bytes=origem,
        nome="Maria Silva",
        projeto="Reencontro Pari",
        ancora_x=36,
        ancora_y=40,
        ancora_h=48,
    )
    assert saida.startswith(b"%PDF")
    assert len(saida) > len(origem)
    texto = PdfReader(io.BytesIO(saida)).pages[0].extract_text() or ""
    assert "Assinado Digitalmente" in texto
    assert "Maria Silva" in texto
    assert "Gestor" in texto


def test_carimbar_assinatura_gestor_na_posicao_escolhida():
    from pypdf import PdfReader

    origem = _pdf_paginas(1, width=500.0, height=700.0)
    saida = carimbar_assinatura_gestor_pdf(
        pdf_bytes=origem,
        nome="Maria Silva",
        projeto="Reencontro Pari",
        x=80.0,
        y=120.0,
        width=220.0,
        height=68.0,
    )
    assert saida.startswith(b"%PDF")
    texto = PdfReader(io.BytesIO(saida)).pages[0].extract_text() or ""
    assert "Assinado Digitalmente" in texto


def test_carimbar_texto_complementar_aparece_em_caixa_baixa():
    from pypdf import PdfReader

    origem = _pdf_paginas(1, width=500.0, height=700.0)
    saida = carimbar_texto_pdf(
        pdf_bytes=origem,
        texto="Parcela 1 vencimento 10/11, PIX Banco do Brasil",
        projeto="CASA PORTO SEGURO",
        x=24.0,
        y=8.0,
        width=320.0,
        height=18.0,
    )
    texto = PdfReader(io.BytesIO(saida)).pages[0].extract_text() or ""
    assert "CASA PORTO SEGURO" in texto
    assert "Parcela 1" in texto


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
