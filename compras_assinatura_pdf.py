"""PDF de orçamento assinado pela Sede (orçamento original + PDF de assinatura)."""

from __future__ import annotations

import io
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def montar_folha_ato_assinatura_sede(
    *,
    numero_pedido: str,
    assinante_nome: str,
    assinado_em_texto: str,
    fornecedor_nome: str,
    valor_texto: str,
    arquivo_orcamento: str,
) -> bytes:
    """Capa didática do ato de assinatura (antes do orçamento + PDF da assinatura)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    titulo = ParagraphStyle("t", parent=styles["Heading1"], fontSize=14, spaceAfter=8)
    corpo = ParagraphStyle("c", parent=styles["Normal"], fontSize=11, leading=15, spaceAfter=6)
    story = [
        Paragraph("Aprovação e assinatura digital — Sede (ADM Compras)", titulo),
        Paragraph(f"<b>Pedido:</b> {numero_pedido}", corpo),
        Paragraph(f"<b>Orçamento vencedor:</b> {fornecedor_nome} · {valor_texto}", corpo),
        Paragraph(f"<b>Arquivo do orçamento:</b> {arquivo_orcamento}", corpo),
        Spacer(1, 8),
        Paragraph(
            f"Ato explícito de assinatura realizado por <b>{assinante_nome}</b> "
            f"em <b>{assinado_em_texto}</b> (horário operacional America/Sao_Paulo).",
            corpo,
        ),
        Paragraph(
            "Nas páginas seguintes: (1) o orçamento escolhido; "
            "(2) o PDF oficial da assinatura digital do aprovador da Sede.",
            corpo,
        ),
    ]
    doc.build(story)
    return buf.getvalue()


def mesclar_orcamento_com_assinatura_pdf(
    *,
    capa_bytes: bytes,
    orcamento_bytes: bytes,
    assinatura_bytes: bytes,
) -> bytes:
    """Une capa + orçamento original + PDF da assinatura cadastrada."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Biblioteca pypdf não instalada.") from exc

    writer = PdfWriter()
    for blob in (capa_bytes, orcamento_bytes, assinatura_bytes):
        try:
            reader = PdfReader(io.BytesIO(blob))
        except Exception as exc:
            raise ValueError(f"Não foi possível ler um dos PDFs da assinatura: {exc}") from exc
        for page in reader.pages:
            writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def valor_centavos_para_texto(centavos: Optional[int]) -> str:
    n = int(centavos or 0)
    return f"R$ {n / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
