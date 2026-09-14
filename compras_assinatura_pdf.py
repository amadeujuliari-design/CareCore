"""PDF de orçamento assinado pela Sede — carimba a assinatura no rodapé da última folha."""

from __future__ import annotations

import io
from typing import Optional


def valor_centavos_para_texto(centavos: Optional[int]) -> str:
    n = int(centavos or 0)
    return f"R$ {n / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def carimbar_assinatura_no_rodape_pdf(
    *,
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
    margem_inferior_pt: float = 28.0,
    margem_lateral_pt: float = 36.0,
    altura_max_fracao: float = 0.22,
) -> bytes:
    """
    Aplica a 1ª página do PDF de assinatura no rodapé da última página do orçamento.
    Não cria página extra nem capa — a assinatura fica na própria folha.
    """
    try:
        from pypdf import PdfReader, PdfWriter, Transformation
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Biblioteca pypdf não instalada.") from exc

    try:
        orc = PdfReader(io.BytesIO(orcamento_bytes))
        sig = PdfReader(io.BytesIO(assinatura_bytes))
    except Exception as exc:
        raise ValueError(f"Não foi possível ler os PDFs: {exc}") from exc

    if not orc.pages:
        raise ValueError("O orçamento PDF não tem páginas.")
    if not sig.pages:
        raise ValueError("O PDF de assinatura não tem páginas.")

    writer = PdfWriter()
    ultima = len(orc.pages) - 1
    sig_page = sig.pages[0]
    sig_w = float(sig_page.mediabox.width)
    sig_h = float(sig_page.mediabox.height)

    for idx, page in enumerate(orc.pages):
        if idx == ultima:
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)
            alvo_w = max(40.0, page_w - (2 * margem_lateral_pt))
            escala = min(alvo_w / max(sig_w, 1.0), (page_h * altura_max_fracao) / max(sig_h, 1.0))
            desenho_w = sig_w * escala
            desenho_h = sig_h * escala
            tx = margem_lateral_pt + max(0.0, (alvo_w - desenho_w) / 2.0)
            ty = margem_inferior_pt
            transform = Transformation().scale(escala, escala).translate(tx, ty)
            try:
                page.merge_transformed_page(sig_page, transform, over=True)
            except TypeError:
                # pypdf antigo sem over=
                page.merge_transformed_page(sig_page, transform)
            except AttributeError:
                # fallback: merge_page sem escala (menos ideal)
                page.merge_page(sig_page)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# Compat: nomes antigos usados em imports/testes pontuais.
def montar_folha_ato_assinatura_sede(**_kwargs) -> bytes:
    """Obsoleto — mantido só para não quebrar imports antigos."""
    return b""


def mesclar_orcamento_com_assinatura_pdf(
    *,
    capa_bytes: bytes = b"",
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
) -> bytes:
    del capa_bytes  # não usa mais capa
    return carimbar_assinatura_no_rodape_pdf(
        orcamento_bytes=orcamento_bytes,
        assinatura_bytes=assinatura_bytes,
    )
