import logoCarecore from "../assets/logo.PNG";
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from "./direitosReservados";

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function abrirPreviewHtml({
  titulo = "Relatório",
  html = "",
  orientacaoInicial = "portrait",
}) {
  const previewExistente = document.getElementById("carecore-relatorio-preview");
  if (previewExistente) {
    previewExistente.remove();
  }

  const container = document.createElement("div");
  container.id = "carecore-relatorio-preview";
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.zIndex = "99999";
  container.style.background = "#f8fafc";
  container.style.display = "flex";
  container.style.flexDirection = "column";

  const barra = document.createElement("div");
  barra.style.display = "flex";
  barra.style.alignItems = "center";
  barra.style.justifyContent = "space-between";
  barra.style.gap = "12px";
  barra.style.padding = "12px 16px";
  barra.style.background = "#ffffff";
  barra.style.borderBottom = "1px solid #e5e7eb";
  barra.style.boxShadow = "0 4px 18px rgba(15, 23, 42, 0.08)";

  const tituloEl = document.createElement("div");
  tituloEl.textContent = titulo;
  tituloEl.style.fontWeight = "800";
  tituloEl.style.color = "#111827";
  tituloEl.style.fontSize = "14px";

  const acoes = document.createElement("div");
  acoes.style.display = "flex";
  acoes.style.alignItems = "center";
  acoes.style.gap = "8px";
  acoes.style.flexWrap = "wrap";

  const grupoOrientacao = document.createElement("label");
  grupoOrientacao.style.display = "flex";
  grupoOrientacao.style.alignItems = "center";
  grupoOrientacao.style.gap = "6px";
  grupoOrientacao.style.fontSize = "12px";
  grupoOrientacao.style.fontWeight = "800";
  grupoOrientacao.style.color = "#475569";
  grupoOrientacao.textContent = "Orientação";

  const seletorOrientacao = document.createElement("select");
  seletorOrientacao.value = orientacaoInicial === "landscape" ? "landscape" : "portrait";
  seletorOrientacao.style.border = "1px solid #d1d5db";
  seletorOrientacao.style.borderRadius = "10px";
  seletorOrientacao.style.padding = "8px 10px";
  seletorOrientacao.style.fontWeight = "800";
  seletorOrientacao.style.background = "#ffffff";
  seletorOrientacao.innerHTML = `
    <option value="portrait">Retrato</option>
    <option value="landscape">Paisagem</option>
  `;
  grupoOrientacao.appendChild(seletorOrientacao);

  const botaoVoltar = document.createElement("button");
  botaoVoltar.type = "button";
  botaoVoltar.textContent = "Voltar";
  botaoVoltar.style.border = "1px solid #d1d5db";
  botaoVoltar.style.background = "#ffffff";
  botaoVoltar.style.color = "#374151";
  botaoVoltar.style.borderRadius = "12px";
  botaoVoltar.style.padding = "9px 14px";
  botaoVoltar.style.fontWeight = "800";
  botaoVoltar.style.cursor = "pointer";
  botaoVoltar.onclick = () => container.remove();

  const botaoImprimir = document.createElement("button");
  botaoImprimir.type = "button";
  botaoImprimir.textContent = "Imprimir";
  botaoImprimir.style.border = "1px solid #0f766e";
  botaoImprimir.style.background = "#0f766e";
  botaoImprimir.style.color = "#ffffff";
  botaoImprimir.style.borderRadius = "12px";
  botaoImprimir.style.padding = "9px 14px";
  botaoImprimir.style.fontWeight = "800";
  botaoImprimir.style.cursor = "pointer";

  const iframe = document.createElement("iframe");
  iframe.title = titulo;
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.flex = "1";
  iframe.style.background = "#ffffff";
  iframe.srcdoc = html;

  const aplicarOrientacaoImpressao = () => {
    const documento = iframe.contentDocument;
    if (!documento) return;

    let estilo = documento.getElementById("carecore-print-orientation-style");
    if (!estilo) {
      estilo = documento.createElement("style");
      estilo.id = "carecore-print-orientation-style";
      documento.head.appendChild(estilo);
    }

    const orientacao = seletorOrientacao.value === "landscape" ? "landscape" : "portrait";
    estilo.textContent = `
      @page {
        size: A4 ${orientacao} !important;
      }
    `;
  };

  iframe.addEventListener("load", aplicarOrientacaoImpressao);
  seletorOrientacao.onchange = aplicarOrientacaoImpressao;

  botaoImprimir.onclick = () => {
    aplicarOrientacaoImpressao();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };

  acoes.append(grupoOrientacao, botaoVoltar, botaoImprimir);
  barra.append(tituloEl, acoes);
  container.append(barra, iframe);
  document.body.appendChild(container);
}

export function imprimirRelatorio({
  titulo = "RELATÓRIO",
  subtitulo = "",
  metricas = [],
  conteudoExtraHtml = "",
  colunas = [],
  dados = [],
  identidade = null,
  orientacao = null,
}) {
  const dataAtual = new Date().toLocaleString("pt-BR");
  const tituloSeguro = escaparHtml(titulo);
  const subtituloSeguro = escaparHtml(subtitulo);
  const logoSrc = identidade?.logo_src || logoCarecore;
  const nomeExibicao = identidade?.relatorio_nome_exibicao || "CARECORE+";
  const urlDireitosReservados = obterUrlDireitosReservados();
  const rodapeItens = [
    identidade?.relatorio_rodape_linha1,
    identidade?.relatorio_rodape_linha2,
    identidade?.relatorio_telefone ? `Telefone: ${identidade.relatorio_telefone}` : "",
    identidade?.relatorio_email ? `E-mail: ${identidade.relatorio_email}` : "",
    identidade?.relatorio_site ? `Site: ${identidade.relatorio_site}` : "",
  ].filter(Boolean);
  const orientacaoInicial = orientacao || (colunas.length > 6 ? "landscape" : "portrait");

  const tabelaCabecalho = colunas
    .map(
      (coluna) => `
        <th>
          ${escaparHtml(coluna)}
        </th>
      `
    )
    .join("");

  const tabelaLinhas = dados
    .map((item) => {
      return `
        <tr>
          ${colunas
            .map(
              (coluna) => `
                <td>
                  ${escaparHtml(item[coluna])}
                </td>
              `
            )
            .join("")}
        </tr>
      `;
    })
    .join("");

  const metricasHtml = metricas
    .map(
      (metrica) => `
        <div class="metrica-card">
          <div class="metrica-label">${escaparHtml(metrica.label)}</div>
          <div class="metrica-valor">${escaparHtml(metrica.valor)}</div>
          ${metrica.detalhe ? `<div class="metrica-detalhe">${escaparHtml(metrica.detalhe)}</div>` : ""}
        </div>
      `
    )
    .join("");

  const rodapeHtml = rodapeItens.length
    ? rodapeItens.map((item) => `<div>${escaparHtml(item)}</div>`).join("")
    : `<div>Relatório gerado pelo CareCore+</div>`;
  const direitosReservadosHtml = `
    <div class="direitos-reservados">
      <a href="${escaparHtml(urlDireitosReservados)}" target="_blank" rel="noopener noreferrer">
        ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
      </a>
    </div>
  `;

  const html = `
    <html>
      <head>
        <title>${tituloSeguro}</title>

        <style>
          @page {
            size: A4;
            margin: 12mm 10mm 14mm;
          }

          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1f2937;
          }

          .pagina-relatorio {
            width: 100%;
            border-collapse: collapse;
          }

          .pagina-relatorio > thead {
            display: table-header-group;
          }

          .pagina-relatorio > tfoot {
            display: table-footer-group;
          }

          .pagina-relatorio > tbody > tr > td,
          .pagina-relatorio > thead > tr > th,
          .pagina-relatorio > tfoot > tr > td {
            border: 0;
            padding: 0;
          }

          .cabecalho-relatorio {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 10px;
            margin-bottom: 14px;
            border-bottom: 2px solid #e5e7eb;
          }

          .logo-relatorio {
            width: 170px;
            max-height: 56px;
            object-fit: contain;
          }

          .titulo-relatorio {
            text-align: right;
          }

          h1 {
            margin: 0 0 4px;
            font-size: 20px;
          }

          .subtitulo {
            margin-bottom: 8px;
            color: #6b7280;
            font-size: 12px;
          }

          .gerado {
            font-size: 12px;
            color: #6b7280;
          }

          .identidade-nome {
            margin-top: 8px;
            font-size: 12px;
            font-weight: 800;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .metricas {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }

          .metrica-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 10px;
            background: #f9fafb;
          }

          .metrica-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 0.03em;
          }

          .metrica-valor {
            margin-top: 4px;
            font-size: 22px;
            font-weight: 800;
            color: #111827;
          }

          .metrica-detalhe {
            margin-top: 3px;
            font-size: 11px;
            color: #6b7280;
          }

          .tabela-dados {
            width: 100%;
            border-collapse: collapse;
          }

          .tabela-dados th {
            background: #f3f4f6;
            text-align: left;
          }

          .tabela-dados th,
          .tabela-dados td {
            border: 1px solid #d1d5db;
            padding: 10px;
            font-size: 13px;
          }

          .tabela-dados tr:nth-child(even) {
            background: #f9fafb;
          }

          .rodape-relatorio {
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            font-size: 10px;
            line-height: 1.35;
            color: #6b7280;
            text-align: center;
          }

          .direitos-reservados {
            margin-top: 5px;
            font-size: 9px;
            font-weight: 700;
          }

          .direitos-reservados a {
            color: #4f46e5;
            text-decoration: none;
          }

          .espaco-rodape {
            height: 10px;
          }

          @media print {
            .metricas {
              grid-template-columns: repeat(4, 1fr);
            }

            .cabecalho-relatorio,
            .rodape-relatorio {
              break-inside: avoid;
            }

            tr,
            .metrica-card {
              break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <table class="pagina-relatorio">
          <thead class="cabecalho-pagina">
            <tr>
              <th>
                <div class="cabecalho-relatorio">
                  <div>
                    <img class="logo-relatorio" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
                    <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
                  </div>

                  <div class="titulo-relatorio">
                    <h1>${tituloSeguro}</h1>

                    ${
                      subtitulo
                        ? `<div class="subtitulo">${subtituloSeguro}</div>`
                        : ""
                    }

                    <div class="gerado">
                      Gerado em: ${dataAtual}
                    </div>
                  </div>
                </div>
              </th>
            </tr>
          </thead>

          <tfoot>
            <tr>
              <td>
                <div class="espaco-rodape"></div>
                <div class="rodape-relatorio">${rodapeHtml}${direitosReservadosHtml}</div>
              </td>
            </tr>
          </tfoot>

          <tbody>
            <tr>
              <td>
                ${
                  metricasHtml
                    ? `<div class="metricas">${metricasHtml}</div>`
                    : ""
                }

                ${conteudoExtraHtml}

                <table class="tabela-dados">
                  <thead>
                    <tr>
                      ${tabelaCabecalho}
                    </tr>
                  </thead>

                  <tbody>
                    ${tabelaLinhas}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  abrirPreviewHtml({
    titulo,
    html,
    orientacaoInicial,
  });
}