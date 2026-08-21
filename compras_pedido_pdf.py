"""PDF de Compras no padrão visual dos relatórios AEB (logo, título, rodapé)."""

from __future__ import annotations

from io import BytesIO
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


COR_TEXTO = colors.HexColor("#1f2937")
COR_MUTED = colors.HexColor("#6b7280")
COR_BORDA = colors.HexColor("#d1d5db")
COR_CABECALHO = colors.HexColor("#f3f4f6")
COR_ACENTO = colors.HexColor("#0f766e")


def _endereco_projeto(inst: Optional[dict[str, Any]]) -> str:
    if not inst:
        return "Endereço de entrega conforme cadastro do projeto."
    partes = [
        inst.get("logradouro"),
        inst.get("numero"),
        inst.get("complemento"),
        inst.get("bairro"),
        inst.get("cidade"),
        inst.get("uf"),
    ]
    texto = ", ".join(p for p in partes if p)
    return texto or inst.get("nome") or "—"


def _fmt_moeda_centavos(centavos: int) -> str:
    return f"R$ {centavos / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "titulo": ParagraphStyle(
            "compras_titulo",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=COR_TEXTO,
            alignment=TA_RIGHT,
            spaceAfter=2,
        ),
        "sub": ParagraphStyle(
            "compras_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=COR_MUTED,
            alignment=TA_RIGHT,
        ),
        "nome_id": ParagraphStyle(
            "compras_nome_id",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#374151"),
            alignment=TA_RIGHT,
            spaceBefore=4,
        ),
        "label": ParagraphStyle(
            "compras_label",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=COR_MUTED,
            spaceAfter=2,
        ),
        "corpo": ParagraphStyle(
            "compras_corpo",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=COR_TEXTO,
        ),
        "corpo_forte": ParagraphStyle(
            "compras_corpo_forte",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=COR_TEXTO,
        ),
        "valor": ParagraphStyle(
            "compras_valor",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=COR_ACENTO,
        ),
        "th": ParagraphStyle(
            "compras_th",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=COR_MUTED,
        ),
        "td": ParagraphStyle(
            "compras_td",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=COR_TEXTO,
        ),
        "rodape": ParagraphStyle(
            "compras_rodape",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=COR_MUTED,
            alignment=TA_LEFT,
        ),
    }


def _logo_flowable(logo_bytes: Optional[bytes]) -> Any:
    if not logo_bytes:
        return Paragraph("<b>AEB</b>", ParagraphStyle("logo_txt", fontName="Helvetica-Bold", fontSize=14, textColor=COR_TEXTO))
    try:
        img = Image(BytesIO(logo_bytes))
        img.hAlign = "LEFT"
        # ~170px ≈ 45mm width, max ~56px height
        max_w, max_h = 48 * mm, 16 * mm
        iw, ih = float(img.imageWidth), float(img.imageHeight)
        if iw <= 0 or ih <= 0:
            raise ValueError("logo inválido")
        escala = min(max_w / iw, max_h / ih)
        img.drawWidth = iw * escala
        img.drawHeight = ih * escala
        return img
    except Exception:  # noqa: BLE001
        return Paragraph("<b>AEB</b>", ParagraphStyle("logo_txt", fontName="Helvetica-Bold", fontSize=14, textColor=COR_TEXTO))


def _cabecalho(styles: dict, *, titulo: str, subtitulo: str, identidade: Optional[dict[str, Any]], logo_bytes: Optional[bytes]):
    nome = (identidade or {}).get("relatorio_nome_exibicao") or "AEB"
    direito = [
        Paragraph(titulo, styles["titulo"]),
        Paragraph(subtitulo, styles["sub"]),
        Paragraph(str(nome).upper(), styles["nome_id"]),
    ]
    tabela = Table(
        [[_logo_flowable(logo_bytes), direito]],
        colWidths=[55 * mm, 125 * mm],
    )
    tabela.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor("#e5e7eb")),
            ]
        )
    )
    return tabela


def _caixa(styles: dict, titulo: str, linhas: list[Any]) -> Table:
    conteudo = [Paragraph(titulo.upper(), styles["label"]), *linhas]
    inner = Table([[conteudo]], colWidths=[180 * mm])
    inner.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, COR_BORDA),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return inner


def _tabela_itens(styles: dict, itens: list[dict[str, Any]]) -> Table:
    cab = [
        Paragraph("QTD", styles["th"]),
        Paragraph("UN", styles["th"]),
        Paragraph("DESCRIÇÃO", styles["th"]),
        Paragraph("EMBALAGEM", styles["th"]),
        Paragraph("MARCA PREF.", styles["th"]),
    ]
    rows = [cab]
    for item in itens:
        rows.append(
            [
                Paragraph(str(item.get("quantidade", "") or ""), styles["td"]),
                Paragraph(str(item.get("unidade_medida") or "un"), styles["td"]),
                Paragraph(str(item.get("descricao") or ""), styles["td"]),
                Paragraph(str(item.get("embalagem") or "—"), styles["td"]),
                Paragraph(str(item.get("marca_preferencial") or "—"), styles["td"]),
            ]
        )
    if len(rows) == 1:
        rows.append([Paragraph("—", styles["td"]), "", "", "", ""])

    tabela = Table(rows, colWidths=[18 * mm, 14 * mm, 78 * mm, 35 * mm, 35 * mm], repeatRows=1)
    tabela.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COR_CABECALHO),
                ("GRID", (0, 0), (-1, -1), 0.4, COR_BORDA),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tabela


def _rodape_itens(identidade: Optional[dict[str, Any]], extra: Optional[str] = None) -> list[str]:
    idn = identidade or {}
    itens = [
        idn.get("relatorio_rodape_linha1"),
        idn.get("relatorio_rodape_linha2"),
        f"Telefone: {idn['relatorio_telefone']}" if idn.get("relatorio_telefone") else None,
        f"E-mail: {idn['relatorio_email']}" if idn.get("relatorio_email") else None,
        f"Site: {idn['relatorio_site']}" if idn.get("relatorio_site") else None,
        extra,
    ]
    limpos = [str(x).strip() for x in itens if x and str(x).strip()]
    return limpos or ["Documento gerado pelo CareCore+"]


def _build_pdf(story: list) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm,
        title="CareCore+ Compras",
    )
    doc.build(story)
    return buffer.getvalue()


def montar_pdf_solicitacao_cotacao(
    *,
    pedido: dict[str, Any],
    instituicao: Optional[dict[str, Any]],
    organizacao_nome: str,
    itens: list[dict[str, Any]],
    numero_pedido: str,
    identidade: Optional[dict[str, Any]] = None,
    logo_bytes: Optional[bytes] = None,
) -> bytes:
    styles = _styles()
    projeto = (instituicao or {}).get("nome") or pedido.get("instituicao_nome") or "Projeto"
    endereco = _endereco_projeto(instituicao)
    org = organizacao_nome or "AEB"
    competencia = pedido.get("competencia") or ""
    tipo = pedido.get("tipo") or ""
    subtitulo = f"{org} · {tipo} · competência {competencia}"

    story: list = [
        _cabecalho(
            styles,
            titulo=f"Solicitação de cotação · {numero_pedido}",
            subtitulo=subtitulo,
            identidade=identidade,
            logo_bytes=logo_bytes,
        ),
        Spacer(1, 8),
        _caixa(
            styles,
            "Projeto solicitante",
            [
                Paragraph(str(projeto), styles["corpo_forte"]),
                Paragraph(f"Entrega: {endereco}", styles["corpo"]),
            ],
        ),
        Spacer(1, 8),
        Paragraph(
            "Solicitamos cotação para os itens abaixo. Responda a este e-mail com o orçamento (PDF).",
            styles["corpo"],
        ),
        Spacer(1, 6),
        Paragraph("ITENS", styles["label"]),
        _tabela_itens(styles, itens),
        Spacer(1, 14),
    ]
    for linha in _rodape_itens(identidade, "Cada fornecedor recebe este pedido individualmente."):
        story.append(Paragraph(linha, styles["rodape"]))
    return _build_pdf(story)


def montar_pdf_pedido_compra(
    *,
    pedido: dict[str, Any],
    instituicao: Optional[dict[str, Any]],
    organizacao_nome: str,
    itens: list[dict[str, Any]],
    cotacao_escolhida: Optional[dict[str, Any]],
    numero_pedido: str,
    identidade: Optional[dict[str, Any]] = None,
    logo_bytes: Optional[bytes] = None,
) -> bytes:
    styles = _styles()
    projeto = (instituicao or {}).get("nome") or pedido.get("instituicao_nome") or "Projeto"
    endereco = _endereco_projeto(instituicao)
    org = organizacao_nome or "AEB"
    competencia = pedido.get("competencia") or ""
    tipo = pedido.get("tipo") or ""
    subtitulo = f"{org} · {tipo} · competência {competencia}"
    fornecedor = (cotacao_escolhida or {}).get("fornecedor_nome") or "—"
    valor = "—"
    if cotacao_escolhida and cotacao_escolhida.get("valor_centavos") is not None:
        valor = _fmt_moeda_centavos(int(cotacao_escolhida.get("valor_centavos") or 0))

    story: list = [
        _cabecalho(
            styles,
            titulo=f"Pedido de compra · {numero_pedido}",
            subtitulo=subtitulo,
            identidade=identidade,
            logo_bytes=logo_bytes,
        ),
        Spacer(1, 8),
        _caixa(
            styles,
            "Projeto solicitante",
            [
                Paragraph(str(projeto), styles["corpo_forte"]),
                Paragraph(f"Entrega: {endereco}", styles["corpo"]),
            ],
        ),
        Spacer(1, 8),
        KeepTogether(
            [
                _caixa(
                    styles,
                    "Fornecedor",
                    [
                        Paragraph(str(fornecedor), styles["corpo_forte"]),
                        Paragraph(f"Valor: {valor}", styles["valor"]),
                    ],
                )
            ]
        ),
        Spacer(1, 8),
        Paragraph("ITENS", styles["label"]),
        _tabela_itens(styles, itens),
        Spacer(1, 14),
    ]
    for linha in _rodape_itens(identidade, "Endereço de entrega do projeto acima."):
        story.append(Paragraph(linha, styles["rodape"]))
    return _build_pdf(story)


# Compat: HTML legado (testes / fallback visual antigo).
from html import escape as _escape_html  # noqa: E402


def montar_html_pedido_compra(
    *,
    pedido: dict[str, Any],
    instituicao: Optional[dict[str, Any]],
    organizacao_nome: str,
    itens: list[dict[str, Any]],
    cotacao_escolhida: Optional[dict[str, Any]],
    numero_pedido: str,
) -> str:
    linhas_itens = "".join(
        f"<tr><td>{_escape_html(str(item.get('quantidade', '')))}</td>"
        f"<td>{_escape_html(item.get('unidade_medida') or 'un')}</td>"
        f"<td>{_escape_html(item.get('descricao') or '')}</td>"
        f"<td>{_escape_html(item.get('embalagem') or '—')}</td>"
        f"<td>{_escape_html(item.get('marca_preferencial') or '—')}</td></tr>"
        for item in itens
    )
    valor = ""
    if cotacao_escolhida:
        centavos = int(cotacao_escolhida.get("valor_centavos") or 0)
        valor = _fmt_moeda_centavos(centavos)
    fornecedor = _escape_html((cotacao_escolhida or {}).get("fornecedor_nome") or "—")
    projeto = _escape_html((instituicao or {}).get("nome") or pedido.get("instituicao_nome") or "Projeto")
    endereco = _escape_html(_endereco_projeto(instituicao))
    org = _escape_html(organizacao_nome or "AEB")
    return (
        f"<h1>Pedido de compra {_escape_html(numero_pedido)}</h1>"
        f"<p>{org}</p><p>{projeto}</p><p>{endereco}</p>"
        f"<p>{fornecedor} {valor}</p><table>{linhas_itens}</table>"
    )


def montar_html_solicitacao_cotacao(
    *,
    pedido: dict[str, Any],
    instituicao: Optional[dict[str, Any]],
    organizacao_nome: str,
    itens: list[dict[str, Any]],
    numero_pedido: str,
) -> str:
    projeto = _escape_html((instituicao or {}).get("nome") or pedido.get("instituicao_nome") or "Projeto")
    return f"<h1>Solicitação de cotação {_escape_html(numero_pedido)}</h1><p>{projeto}</p>"
