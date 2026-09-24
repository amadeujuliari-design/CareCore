"""PDF de orçamento assinado pela Sede — carimba a assinatura na posição escolhida."""

from __future__ import annotations

import io
from typing import Optional, Tuple


def valor_centavos_para_texto(centavos: Optional[int]) -> str:
    n = int(centavos or 0)
    return f"R$ {n / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _extrair_imagem_assinatura(assinatura_bytes: bytes):
    """Extrai a imagem embutida da 1ª página do PDF de assinatura (PIL Image)."""
    from pypdf import PdfReader

    try:
        sig = PdfReader(io.BytesIO(assinatura_bytes))
    except Exception as exc:
        raise ValueError(f"Não foi possível ler o PDF de assinatura: {exc}") from exc
    if not sig.pages:
        raise ValueError("O PDF de assinatura não tem páginas.")

    page = sig.pages[0]
    try:
        imagens = list(page.images)
    except Exception:
        imagens = []

    if imagens:
        return imagens[0].image.convert("RGBA")

    # Página só com vetores — caller usa merge clássico (sem transparência).
    return None


def _rgba_fundo_transparente(img):
    """
    Remove fundo branco mantendo a tinta (preto/azul) com anti-alias suave.

    Alpha ≈ distância do branco (255 - min(R,G,B)), o que preserva traços
    coloridos e bordas suaves sem bloco opaco.
    """
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            alpha = 255 - min(r, g, b)
            if alpha < 10:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # leve reforço para a tinta não ficar “lavada” sobre o texto
                pixels[x, y] = (r, g, b, min(255, int(alpha * 1.2)))
    return rgba


def _png_bytes(img) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _overlay_pdf_png(png_bytes: bytes, width_pt: float, height_pt: float) -> bytes:
    """Monta um PDF de 1 página com PNG transparente no tamanho do carimbo."""
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as pdf_canvas

    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=(width_pt, height_pt))
    c.drawImage(
        ImageReader(io.BytesIO(png_bytes)),
        0,
        0,
        width=width_pt,
        height=height_pt,
        mask="auto",
        preserveAspectRatio=False,
        anchor="c",
    )
    c.save()
    return buf.getvalue()


def _dimensoes_carimbo(
    *,
    page_w: float,
    page_h: float,
    img_w: float,
    img_h: float,
    x: Optional[float],
    y: Optional[float],
    width: Optional[float],
    height: Optional[float],
    margem_inferior_pt: float,
    margem_lateral_pt: float,
    altura_max_fracao: float,
) -> Tuple[float, float, float, float]:
    """Retorna (tx, ty, desenho_w, desenho_h) em pontos PDF."""
    posicionado = x is not None and y is not None and width is not None and height is not None
    if posicionado:
        desenho_w = max(8.0, min(float(width), page_w))
        desenho_h = max(8.0, min(float(height), page_h))
        tx = max(0.0, min(float(x), page_w - desenho_w))
        ty = max(0.0, min(float(y), page_h - desenho_h))
        return tx, ty, desenho_w, desenho_h

    alvo_w = max(40.0, page_w - (2 * margem_lateral_pt))
    escala = min(
        alvo_w / max(img_w, 1.0),
        (page_h * altura_max_fracao) / max(img_h, 1.0),
    )
    desenho_w = img_w * escala
    desenho_h = img_h * escala
    tx = margem_lateral_pt + max(0.0, (alvo_w - desenho_w) / 2.0)
    ty = margem_inferior_pt
    return tx, ty, desenho_w, desenho_h


def carimbar_assinatura_pdf(
    *,
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
    page_index: Optional[int] = None,
    x: Optional[float] = None,
    y: Optional[float] = None,
    width: Optional[float] = None,
    height: Optional[float] = None,
    margem_inferior_pt: float = 28.0,
    margem_lateral_pt: float = 36.0,
    altura_max_fracao: float = 0.22,
) -> bytes:
    """
    Aplica a assinatura sobre o orçamento com fundo transparente (quando possível).

    Coordenadas em pontos PDF (origem canto inferior esquerdo).
    Se x/y/width/height não forem informados, usa o layout antigo (rodapé da última página).
    """
    try:
        from pypdf import PdfReader, PdfWriter, Transformation
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Biblioteca pypdf não instalada.") from exc

    try:
        orc = PdfReader(io.BytesIO(orcamento_bytes))
    except Exception as exc:
        raise ValueError(f"Não foi possível ler o orçamento PDF: {exc}") from exc

    if not orc.pages:
        raise ValueError("O orçamento PDF não tem páginas.")

    total_paginas = len(orc.pages)
    if page_index is None:
        alvo_idx = total_paginas - 1
    else:
        alvo_idx = int(page_index)
        if alvo_idx < 0 or alvo_idx >= total_paginas:
            raise ValueError(
                f"Página inválida ({alvo_idx + 1}). O orçamento tem {total_paginas} página(s)."
            )

    img = _extrair_imagem_assinatura(assinatura_bytes)
    usar_transparencia = img is not None
    if usar_transparencia:
        img = _rgba_fundo_transparente(img)
        png_bytes = _png_bytes(img)
        img_w, img_h = float(img.size[0]), float(img.size[1])
        sig_page = None
    else:
        try:
            sig = PdfReader(io.BytesIO(assinatura_bytes))
        except Exception as exc:
            raise ValueError(f"Não foi possível ler o PDF de assinatura: {exc}") from exc
        if not sig.pages:
            raise ValueError("O PDF de assinatura não tem páginas.")
        sig_page = sig.pages[0]
        img_w = float(sig_page.mediabox.width)
        img_h = float(sig_page.mediabox.height)
        png_bytes = b""

    writer = PdfWriter()
    for idx, page in enumerate(orc.pages):
        if idx == alvo_idx:
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)
            tx, ty, desenho_w, desenho_h = _dimensoes_carimbo(
                page_w=page_w,
                page_h=page_h,
                img_w=img_w,
                img_h=img_h,
                x=x,
                y=y,
                width=width,
                height=height,
                margem_inferior_pt=margem_inferior_pt,
                margem_lateral_pt=margem_lateral_pt,
                altura_max_fracao=altura_max_fracao,
            )

            if usar_transparencia:
                overlay_bytes = _overlay_pdf_png(png_bytes, desenho_w, desenho_h)
                overlay_page = PdfReader(io.BytesIO(overlay_bytes)).pages[0]
                transform = Transformation().translate(tx, ty)
                try:
                    page.merge_transformed_page(overlay_page, transform, over=True)
                except TypeError:
                    page.merge_transformed_page(overlay_page, transform)
            else:
                escala_x = desenho_w / max(img_w, 1.0)
                escala_y = desenho_h / max(img_h, 1.0)
                transform = Transformation().scale(sx=escala_x, sy=escala_y).translate(tx, ty)
                try:
                    page.merge_transformed_page(sig_page, transform, over=True)
                except TypeError:
                    page.merge_transformed_page(sig_page, transform)
                except AttributeError:
                    page.merge_page(sig_page)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def carimbar_assinatura_no_rodape_pdf(
    *,
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
    margem_inferior_pt: float = 28.0,
    margem_lateral_pt: float = 36.0,
    altura_max_fracao: float = 0.22,
) -> bytes:
    """Compat: carimba no rodapé da última página (layout antigo)."""
    return carimbar_assinatura_pdf(
        orcamento_bytes=orcamento_bytes,
        assinatura_bytes=assinatura_bytes,
        margem_inferior_pt=margem_inferior_pt,
        margem_lateral_pt=margem_lateral_pt,
        altura_max_fracao=altura_max_fracao,
    )


def montar_folha_ato_assinatura_sede(**_kwargs) -> bytes:
    """Obsoleto — mantido só para não quebrar imports antigos."""
    return b""


def mesclar_orcamento_com_assinatura_pdf(
    *,
    capa_bytes: bytes = b"",
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
) -> bytes:
    del capa_bytes
    return carimbar_assinatura_no_rodape_pdf(
        orcamento_bytes=orcamento_bytes,
        assinatura_bytes=assinatura_bytes,
    )


def carimbar_texto_pdf(
    *,
    pdf_bytes: bytes,
    texto: str,
    page_index: int = 0,
    x: float = 36.0,
    y: float = 36.0,
    width: float = 240.0,
    height: float = 48.0,
) -> bytes:
    """Grava o texto complementar dentro do PDF da NF, na caixa escolhida."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Frame, Paragraph
    from reportlab.pdfgen import canvas as pdf_canvas

    conteudo = (texto or "").strip()
    if not conteudo:
        return pdf_bytes
    leitor = PdfReader(io.BytesIO(pdf_bytes))
    if not leitor.pages:
        raise ValueError("O PDF da NF não tem páginas.")
    indice = max(0, min(int(page_index or 0), len(leitor.pages) - 1))
    pagina = leitor.pages[indice]
    caixa = pagina.mediabox
    page_w = float(caixa.width)
    page_h = float(caixa.height)
    desenho_w = max(24.0, min(float(width), page_w))
    desenho_h = max(12.0, min(float(height), page_h))
    tx = max(0.0, min(float(x), page_w - desenho_w))
    ty = max(0.0, min(float(y), page_h - desenho_h))

    buf = io.BytesIO()
    folha = pdf_canvas.Canvas(buf, pagesize=(page_w, page_h))
    estilo = ParagraphStyle(
        "nf_complemento",
        fontName="Helvetica",
        fontSize=8 if desenho_h < 22 else 9,
        leading=10,
        textColor="#111111",
    )
    html = conteudo.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    quadro = Frame(tx, ty, desenho_w, desenho_h, showBoundary=0, leftPadding=2, rightPadding=2, topPadding=1, bottomPadding=1)
    quadro.addFromList([Paragraph(html, estilo)], folha)
    folha.save()
    overlay = PdfReader(io.BytesIO(buf.getvalue()))
    pagina.merge_page(overlay.pages[0])
    escritor = PdfWriter()
    for pagina_atual in leitor.pages:
        escritor.add_page(pagina_atual)
    saida = io.BytesIO()
    escritor.write(saida)
    return saida.getvalue()
