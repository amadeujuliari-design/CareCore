"""HTML do pedido de compra (identidade CareCore / projeto)."""

from __future__ import annotations

from html import escape
from typing import Any, Optional


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
        f"<tr><td>{escape(str(item.get('quantidade', '')))}</td>"
        f"<td>{escape(item.get('unidade_medida') or 'un')}</td>"
        f"<td>{escape(item.get('descricao') or '')}</td>"
        f"<td>{escape(item.get('embalagem') or '—')}</td>"
        f"<td>{escape(item.get('marca_preferencial') or '—')}</td></tr>"
        for item in itens
    )
    valor = ""
    if cotacao_escolhida:
        centavos = int(cotacao_escolhida.get("valor_centavos") or 0)
        valor = f"R$ {centavos / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    fornecedor = escape((cotacao_escolhida or {}).get("fornecedor_nome") or "—")
    projeto = escape((instituicao or {}).get("nome") or pedido.get("instituicao_nome") or "Projeto")
    endereco = escape(_endereco_projeto(instituicao))
    org = escape(organizacao_nome or "AEB")
    competencia = escape(pedido.get("competencia") or "")
    tipo = escape(pedido.get("tipo") or "")

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pedido de compra {escape(numero_pedido)}</title>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 24px; }}
    h1 {{ font-size: 20px; margin: 0 0 4px; }}
    .sub {{ color: #64748b; font-size: 13px; margin-bottom: 20px; }}
    .box {{ border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
    th, td {{ border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }}
    th {{ background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }}
    .label {{ font-size: 11px; color: #64748b; text-transform: uppercase; }}
    .valor {{ font-size: 18px; font-weight: 700; color: #0f766e; }}
  </style>
</head>
<body>
  <h1>Pedido de compra · {escape(numero_pedido)}</h1>
  <p class="sub">{org} · {tipo} · competência {competencia}</p>

  <div class="box">
    <div class="label">Projeto solicitante</div>
    <strong>{projeto}</strong>
    <p style="margin:8px 0 0;font-size:13px;">Entrega: {endereco}</p>
  </div>

  <div class="box">
    <div class="label">Fornecedor</div>
    <strong>{fornecedor}</strong>
    <p class="valor" style="margin-top:8px;">Valor: {valor or '—'}</p>
  </div>

  <div class="box">
    <div class="label">Itens</div>
    <table>
      <thead><tr><th>Qtd</th><th>Un</th><th>Descrição</th><th>Embalagem</th><th>Marca pref.</th></tr></thead>
      <tbody>{linhas_itens or '<tr><td colspan="5">—</td></tr>'}</tbody>
    </table>
  </div>

  <p style="font-size:11px;color:#94a3b8;margin-top:32px;">
    Documento gerado pelo CareCore+. Endereço de entrega do projeto acima.
  </p>
</body>
</html>"""
