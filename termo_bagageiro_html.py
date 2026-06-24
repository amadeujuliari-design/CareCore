from __future__ import annotations

import html
from datetime import date, datetime

from termo_bagageiro_texto import (
    TERMO_BAGAGEIRO_COMPROMISSO,
    TERMO_BAGAGEIRO_ITENS,
    TERMO_BAGAGEIRO_RETIRADA_SUBTITULO,
    TERMO_BAGAGEIRO_RETIRADA_TEXTO,
    TERMO_BAGAGEIRO_RETIRADA_TITULO,
    TERMO_BAGAGEIRO_TITULO,
)


def _esc(valor) -> str:
    return html.escape(str(valor or ""))


def _data_br(valor=None) -> str:
    if valor is None:
        return date.today().strftime("%d/%m/%Y")
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y")
    texto = str(valor)
    try:
        if "T" in texto:
            return datetime.fromisoformat(texto.replace("Z", "+00:00")).strftime("%d/%m/%Y")
        return datetime.fromisoformat(f"{texto}T00:00:00").strftime("%d/%m/%Y")
    except ValueError:
        return ""


def _assinatura_digital_html(assinatura_digital: dict | None) -> str:
    if not assinatura_digital:
        return '<div class="assinatura-espaco"></div>'

    linhas = ["Assinado Digitalmente"]
    metodo = assinatura_digital.get("metodo_leitura") or (
        "qr_code" if "-" in str(assinatura_digital.get("codigo_lido") or "") else "codigo_barras"
    )
    codigo = assinatura_digital.get("codigo_lido")
    if codigo:
        linhas.append(f"Código: {codigo}")
    if assinatura_digital.get("numero_prontuario"):
        linhas.append(f"Prontuário #{assinatura_digital['numero_prontuario']}")
    assinado_em = assinatura_digital.get("assinado_em")
    if assinado_em:
        try:
            linhas.append(_data_br(assinado_em) if "T" not in str(assinado_em) else datetime.fromisoformat(
                str(assinado_em).replace("Z", "+00:00")
            ).strftime("%d/%m/%Y %H:%M:%S"))
        except ValueError:
            pass

    return (
        '<div class="assinatura-digital-texto">'
        + "".join(f"<div>{_esc(linha)}</div>" for linha in linhas)
        + "</div>"
    )


def _bloco_assinatura(rotulo: str, assinatura_digital: dict | None = None, convivente: bool = False) -> str:
    conteudo = _assinatura_digital_html(assinatura_digital) if convivente and assinatura_digital else (
        '<div class="assinatura-espaco"></div>'
    )
    return f"""
    <div class="assinatura-bloco">
      {conteudo}
      <div class="assinatura-traco"></div>
      <div class="assinatura-rotulo">{_esc(rotulo)}</div>
    </div>
    """


def estilos_termo_bagageiro() -> str:
    return """
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 10px;
      line-height: 1.4;
    }
    .pagina {
      width: 100%;
      max-width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      padding: 0;
      display: flex;
      flex-direction: column;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .corpo-termo { flex: 0 0 auto; }
    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .cabecalho img { max-height: 14mm; max-width: 65mm; object-fit: contain; }
    .titulo {
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 10px;
      color: #1e3a8a;
    }
    .convivente-resumo {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 12px;
      font-size: 9.5px;
    }
    .convivente-resumo strong { color: #475569; text-transform: uppercase; font-size: 8px; }
    ol.termo-itens { margin: 0 0 10px 18px; padding: 0; }
    ol.termo-itens li { margin-bottom: 4px; text-align: justify; }
    .compromisso {
      font-weight: 700;
      text-align: justify;
      margin: 10px 0;
      padding: 8px 10px;
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      font-size: 10px;
    }
    .campos-linha {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 10px;
    }
    .campo-linha label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .campo-linha .linha {
      border-bottom: 1px solid #111827;
      min-height: 18px;
      padding-top: 3px;
      font-weight: 600;
    }
    .secao-retirada {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #94a3b8;
      page-break-inside: avoid;
    }
    .secao-retirada h3 {
      margin: 0 0 4px;
      font-size: 11px;
      text-transform: uppercase;
      color: #1e3a8a;
    }
    .secao-retirada p { margin: 0 0 6px; font-size: 9.5px; color: #64748b; }
    .assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 10px;
    }
    .assinaturas-compactas .assinatura-bloco { min-height: 18mm; }
    .assinaturas-compactas .assinatura-espaco { min-height: 12mm; }
    .assinatura-bloco { display: flex; flex-direction: column; min-height: 24mm; }
    .assinatura-espaco { flex: 1 1 auto; min-height: 16mm; }
    .assinatura-traco { border-bottom: 1px solid #111827; width: 100%; }
    .assinatura-rotulo {
      padding-top: 5px;
      text-align: center;
      font-size: 9.5px;
      color: #374151;
    }
    .assinatura-digital-texto {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 16mm;
      padding: 4px 6px;
      text-align: center;
      font-size: 9px;
      line-height: 1.35;
      font-weight: 700;
    }
    .assinatura-digital-texto div + div { margin-top: 2px; }
    .obs-label { font-size: 9.5px; font-weight: 700; margin-top: 8px; }
    .obs-linha {
      margin-top: 8px;
      border-bottom: 1px solid #111827;
      min-height: 12mm;
    }
    .rodape {
      flex: 0 0 auto;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-size: 8px;
      color: #64748b;
      text-align: center;
    }
    @media print {
      .pagina { page-break-after: avoid; page-break-inside: avoid; }
    }
    """


def montar_html_termo_bagageiro(
    *,
    convivente,
    assinatura_digital: dict | None = None,
    nome_funcionario: str = "",
    nome_exibicao: str = "CARECORE+",
) -> str:
    nome_convivente = getattr(convivente, "nome_social", None) or getattr(convivente, "nome_completo", None) or ""
    prontuario = (
        f"#{convivente.numero_institucional}"
        if getattr(convivente, "numero_institucional", None)
        else "S/N"
    )
    data_hoje = _data_br()
    itens_html = "".join(
        f'<li value="{index + 1}">{_esc(item)}</li>' for index, item in enumerate(TERMO_BAGAGEIRO_ITENS)
    )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>{_esc(TERMO_BAGAGEIRO_TITULO)} - {_esc(nome_convivente)}</title>
    <style>{estilos_termo_bagageiro()}</style>
  </head>
  <body>
    <section class="pagina">
      <div class="corpo-termo">
      <div class="cabecalho">
        <strong style="font-size:10px;color:#1e3a8a;">{_esc(nome_exibicao)}</strong>
        <strong style="font-size:9px;color:#1e3a8a;">CARECORE+</strong>
      </div>
      <h1 class="titulo">{_esc(TERMO_BAGAGEIRO_TITULO)}</h1>
      <div class="convivente-resumo">
        <div><strong>Nome</strong><br>{_esc(nome_convivente)}</div>
        <div><strong>Prontuário</strong><br>{_esc(prontuario)}</div>
        <div><strong>CPF</strong><br>{_esc(getattr(convivente, "cpf", None) or "Não informado")}</div>
        <div><strong>Data</strong><br>{_esc(data_hoje)}</div>
      </div>
      <ol class="termo-itens" type="I">{itens_html}</ol>
      <p class="compromisso">{_esc(TERMO_BAGAGEIRO_COMPROMISSO)}</p>
      <div class="campos-linha">
        <div class="campo-linha"><label>Nome</label><div class="linha">{_esc(nome_convivente)}</div></div>
        <div class="campo-linha"><label>Data</label><div class="linha">{_esc(data_hoje)}</div></div>
      </div>
      <div class="campos-linha">
        <div class="campo-linha"><label>Funcionário</label><div class="linha">{_esc(nome_funcionario)}</div></div>
        <div></div>
      </div>
      <div class="assinaturas">
        {_bloco_assinatura("Assinatura do atendido", assinatura_digital, convivente=True)}
        {_bloco_assinatura("Funcionário SIAT II Armênia")}
      </div>
      </div>
      <div class="secao-retirada">
        <h3>{_esc(TERMO_BAGAGEIRO_RETIRADA_TITULO)}</h3>
        <p>{_esc(TERMO_BAGAGEIRO_RETIRADA_SUBTITULO)}</p>
        <p>{_esc(TERMO_BAGAGEIRO_RETIRADA_TEXTO)}</p>
        <div class="obs-label">OBS:</div>
        <div class="obs-linha"></div>
        <div class="assinaturas assinaturas-compactas">
          {_bloco_assinatura("Assinatura do atendido")}
          {_bloco_assinatura("Funcionário SIAT II Armênia")}
        </div>
      </div>
      <div class="rodape">{_esc(nome_exibicao)} · CARECORE+</div>
    </section>
  </body>
</html>"""


def assinatura_registro_para_html(registro) -> dict | None:
    if not registro or not getattr(registro, "codigo_lido", None):
        return None
    return {
        "metodo_leitura": registro.metodo_leitura,
        "codigo_lido": registro.codigo_lido,
        "numero_prontuario": registro.numero_prontuario,
        "assinado_em": registro.assinado_em,
    }
