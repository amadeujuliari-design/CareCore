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


def juntar_pdfs(arquivos: list[bytes]) -> bytes:
    """Junta vários PDFs num só, na ordem enviada."""
    from pypdf import PdfReader, PdfWriter

    escritor = PdfWriter()
    for bruto in arquivos:
        leitor = PdfReader(io.BytesIO(bruto))
        if not leitor.pages:
            raise ValueError("Um dos PDFs não tem páginas.")
        for pagina in leitor.pages:
            escritor.add_page(pagina)
    if not escritor.pages:
        raise ValueError("Nenhum PDF para juntar.")
    saida = io.BytesIO()
    escritor.write(saida)
    return saida.getvalue()


def anexo_bytes_como_pdf(
    conteudo: bytes,
    *,
    nome: str = "",
    content_type: str = "",
) -> bytes:
    """Devolve PDF: o arquivo original ou uma página A4 com a imagem."""
    if not conteudo:
        raise ValueError("Arquivo de orçamento vazio.")
    nome_l = (nome or "").lower()
    ct = (content_type or "").lower()
    if nome_l.endswith(".pdf") or "pdf" in ct:
        return conteudo

    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as pdf_canvas

    img = Image.open(io.BytesIO(conteudo))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    pw, ph = A4
    margem = 36.0
    max_w, max_h = pw - 2 * margem, ph - 2 * margem
    iw, ih = img.size
    if iw <= 0 or ih <= 0:
        raise ValueError("Imagem de orçamento inválida.")
    escala = min(max_w / iw, max_h / ih)
    w, h = iw * escala, ih * escala
    buf_img = io.BytesIO()
    img.save(buf_img, format="JPEG", quality=90)
    buf_img.seek(0)
    saida = io.BytesIO()
    cnv = pdf_canvas.Canvas(saida, pagesize=A4)
    cnv.drawImage(
        ImageReader(buf_img),
        (pw - w) / 2.0,
        (ph - h) / 2.0,
        width=w,
        height=h,
    )
    cnv.save()
    return saida.getvalue()


def juntar_anexos_orcamento(partes: list[tuple[bytes, str, str]]) -> bytes:
    """Junta PDFs e imagens de orçamento num único PDF, na ordem enviada."""
    if not partes:
        raise ValueError("Nenhum orçamento para juntar.")
    pdfs = [
        anexo_bytes_como_pdf(bruto, nome=nome, content_type=tipo)
        for bruto, nome, tipo in partes
    ]
    if len(pdfs) == 1:
        return pdfs[0]
    return juntar_pdfs(pdfs)


def _quebrar_linhas_pdf(texto: str, largura: float, font_size: float) -> list[str]:
    from reportlab.pdfbase.pdfmetrics import stringWidth

    linhas: list[str] = []
    for trecho in (texto or "").split("\n"):
        if not trecho:
            linhas.append("")
            continue
        atual = ""
        for palavra in trecho.split(" "):
            candidato = palavra if not atual else f"{atual} {palavra}"
            if stringWidth(candidato, "Helvetica", font_size) <= largura:
                atual = candidato
                continue
            if atual:
                linhas.append(atual)
            if stringWidth(palavra, "Helvetica", font_size) <= largura:
                atual = palavra
                continue
            buf = ""
            for ch in palavra:
                if stringWidth(buf + ch, "Helvetica", font_size) <= largura:
                    buf += ch
                else:
                    if buf:
                        linhas.append(buf)
                    buf = ch
            atual = buf
        linhas.append(atual)
    return linhas or [""]


def _desenhar_texto_complementar(
    folha,
    texto: str,
    tx: float,
    ty: float,
    largura: float,
    altura: float,
    *,
    projeto: str | None = None,
) -> None:
    """Desenha o texto na moldura. O nome do projeto (1ª linha) fica 3pt maior e em negrito."""
    from reportlab.lib.colors import HexColor
    from reportlab.pdfbase.pdfmetrics import stringWidth

    caixa_baixa = altura < 22
    padding = 2.0 if caixa_baixa else 3.0
    util_w = max(12.0, largura - (padding * 2))
    util_h = max(8.0, altura - (padding * 2))
    nome_projeto = (projeto or "").strip()
    resto = (texto or "").strip()
    if nome_projeto and resto.upper().startswith(nome_projeto.upper()):
        resto = resto[len(nome_projeto):].lstrip("\n")
    max_font = 9 if altura >= 22 else 8
    escolhido = 5
    linhas_resto: list[str] = _quebrar_linhas_pdf(resto, util_w, max_font) if resto else []

    def _metricas(font_size: int):
        projeto_size = font_size + 3
        leading_proj = projeto_size if caixa_baixa else projeto_size + 2
        leading = font_size if caixa_baixa else font_size + (1 if font_size <= 6 else 2)
        return projeto_size, leading_proj, leading

    for font_size in range(max_font, 4, -1):
        tentativas = _quebrar_linhas_pdf(resto, util_w, font_size) if resto else []
        projeto_size, leading_proj, leading = _metricas(font_size)
        altura_usada = (leading_proj if nome_projeto else 0) + (len(tentativas) * leading)
        if altura_usada <= util_h or font_size == 5:
            escolhido = font_size
            linhas_resto = tentativas
            break
    projeto_size, leading_proj, leading = _metricas(escolhido)
    folha.setFillColor(HexColor("#111111"))
    y_texto = ty + altura - padding - (projeto_size if nome_projeto else escolhido)
    if nome_projeto:
        folha.setFont("Helvetica-Bold", projeto_size)
        nome = nome_projeto
        while nome and stringWidth(nome, "Helvetica-Bold", projeto_size) > util_w:
            nome = nome[:-1]
        if nome:
            folha.drawString(tx + padding, y_texto, nome)
        y_texto -= leading_proj
    folha.setFont("Helvetica", escolhido)
    piso = ty
    cabem_resto = max(0, int((y_texto - piso) // max(leading, 1)) + 1) if linhas_resto else 0
    for linha in linhas_resto[:cabem_resto]:
        if y_texto < piso:
            break
        if linha:
            folha.drawString(tx + padding, y_texto, linha)
        y_texto -= leading


def carimbar_texto_pdf(
    *,
    pdf_bytes: bytes,
    texto: str,
    page_index: int = 0,
    x: float = 36.0,
    y: float = 36.0,
    width: float = 240.0,
    height: float = 48.0,
    projeto: str | None = None,
    todas_as_paginas: bool = False,
) -> bytes:
    """Grava o texto complementar dentro do PDF, com moldura. O projeto abre o texto."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas as pdf_canvas

    conteudo = (texto or "").strip()
    nome_projeto = (projeto or "").strip()
    if nome_projeto:
        conteudo = f"{nome_projeto}\n{conteudo}".strip()
    if not conteudo:
        return pdf_bytes
    leitor = PdfReader(io.BytesIO(pdf_bytes))
    if not leitor.pages:
        raise ValueError("O PDF da NF não tem páginas.")
    indices = range(len(leitor.pages)) if todas_as_paginas else (
        max(0, min(int(page_index or 0), len(leitor.pages) - 1)),
    )
    for indice in indices:
        pagina = leitor.pages[indice]
        caixa = pagina.mediabox
        page_w = float(caixa.width)
        page_h = float(caixa.height)
        desenho_w = max(24.0, min(float(width), page_w))
        desenho_h = max(16.0, min(float(height), page_h))
        tx = max(0.0, min(float(x), page_w - desenho_w))
        ty = max(0.0, min(float(y), page_h - desenho_h))

        buf = io.BytesIO()
        folha = pdf_canvas.Canvas(buf, pagesize=(page_w, page_h))
        folha.setStrokeColor(HexColor("#1e3a5f"))
        folha.setFillColor(HexColor("#fffbeb"))
        folha.setLineWidth(1)
        folha.roundRect(tx, ty, desenho_w, desenho_h, 3, stroke=1, fill=1)
        _desenhar_texto_complementar(
            folha, conteudo, tx, ty, desenho_w, desenho_h, projeto=nome_projeto,
        )
        folha.save()
        overlay = PdfReader(io.BytesIO(buf.getvalue()))
        pagina.merge_page(overlay.pages[0])
    escritor = PdfWriter()
    for pagina_atual in leitor.pages:
        escritor.add_page(pagina_atual)
    saida = io.BytesIO()
    escritor.write(saida)
    return saida.getvalue()


def _escapar_pdf(texto: str) -> str:
    return (
        (texto or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def carimbar_assinatura_gestor_pdf(
    *,
    pdf_bytes: bytes,
    nome: str,
    projeto: str,
    page_index: int = 0,
    ancora_x: float | None = None,
    ancora_y: float | None = None,
    ancora_h: float = 0.0,
    x: float | None = None,
    y: float | None = None,
    width: float | None = None,
    height: float | None = None,
    todas_as_paginas: bool = False,
) -> bytes:
    """Carimbo de ciência do gestor do projeto sobre o PDF da nota fiscal."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Frame, Paragraph
    from reportlab.pdfgen import canvas as pdf_canvas

    leitor = PdfReader(io.BytesIO(pdf_bytes))
    if not leitor.pages:
        raise ValueError("O PDF da NF não tem páginas.")
    indices = range(len(leitor.pages)) if todas_as_paginas else (
        max(0, min(int(page_index or 0), len(leitor.pages) - 1)),
    )
    for indice in indices:
        pagina = leitor.pages[indice]
        caixa = pagina.mediabox
        page_w = float(caixa.width)
        page_h = float(caixa.height)
        desenho_w = min(250.0, max(160.0, page_w - 48.0))
        desenho_h = 68.0
        if x is not None and y is not None:
            desenho_w = max(120.0, min(float(width or 250.0), page_w - 8.0))
            desenho_h = max(48.0, min(float(height or 68.0), page_h - 8.0))
            tx = max(0.0, min(float(x), page_w - desenho_w))
            ty = max(0.0, min(float(y), page_h - desenho_h))
        elif ancora_x is not None and ancora_y is not None:
            tx = max(8.0, min(float(ancora_x), page_w - desenho_w - 8.0))
            acima = float(ancora_y) + float(ancora_h or 0) + 8.0
            abaixo = float(ancora_y) - desenho_h - 8.0
            if acima + desenho_h <= page_h - 8.0:
                ty = acima
            elif abaixo >= 8.0:
                ty = abaixo
            else:
                ty = max(8.0, page_h - desenho_h - 36.0)
        else:
            tx = 36.0
            ty = max(8.0, page_h - desenho_h - 36.0)

        nome_limpo = (nome or "Gestor").strip()
        projeto_limpo = (projeto or "Projeto").strip()
        html = (
            f"<b>Assinado Digitalmente</b><br/>{_escapar_pdf(nome_limpo)}<br/>"
            f"{_escapar_pdf(projeto_limpo)}<br/>Cargo: Gestor"
        )
        buf = io.BytesIO()
        folha = pdf_canvas.Canvas(buf, pagesize=(page_w, page_h))
        folha.setStrokeColor(HexColor("#1e3a5f"))
        folha.setFillColor(HexColor("#f8fafc"))
        folha.setLineWidth(1)
        folha.roundRect(tx, ty, desenho_w, desenho_h, 4, stroke=1, fill=1)
        estilo = ParagraphStyle(
            "nf_assinatura_gestor",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=HexColor("#0f172a"),
        )
        quadro = Frame(
            tx + 6,
            ty + 4,
            desenho_w - 12,
            desenho_h - 8,
            showBoundary=0,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
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
