import logoCarecore from "../assets/logo.png";

export function imprimirRelatorio({
  titulo = "RELATÓRIO",
  subtitulo = "",
  colunas = [],
  dados = [],
}) {
  const dataAtual = new Date().toLocaleString("pt-BR");

  const tabelaCabecalho = colunas
    .map(
      (coluna) => `
        <th>
          ${coluna}
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
                  ${item[coluna] ?? ""}
                </td>
              `
            )
            .join("")}
        </tr>
      `;
    })
    .join("");

  const janela = window.open("", "_blank");

  janela.document.write(`
    <html>
      <head>
        <title>${titulo}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px;
            color: #1f2937;
          }

          .cabecalho-relatorio {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 18px;
            margin-bottom: 24px;
            border-bottom: 2px solid #e5e7eb;
          }

          .logo-relatorio {
            width: 220px;
            max-height: 84px;
            object-fit: contain;
          }

          .titulo-relatorio {
            text-align: right;
          }

          h1 {
            margin-bottom: 4px;
          }

          .subtitulo {
            margin-bottom: 24px;
            color: #6b7280;
          }

          .gerado {
            margin-bottom: 24px;
            font-size: 12px;
            color: #6b7280;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th {
            background: #f3f4f6;
            text-align: left;
          }

          th,
          td {
            border: 1px solid #d1d5db;
            padding: 10px;
            font-size: 13px;
          }

          tr:nth-child(even) {
            background: #f9fafb;
          }

          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>

      <body>
        <div class="cabecalho-relatorio">
          <img class="logo-relatorio" src="${logoCarecore}" alt="CARECORE+" />

          <div class="titulo-relatorio">
            <h1>${titulo}</h1>

            ${
              subtitulo
                ? `<div class="subtitulo">${subtitulo}</div>`
                : ""
            }

            <div class="gerado">
              Gerado em: ${dataAtual}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              ${tabelaCabecalho}
            </tr>
          </thead>

          <tbody>
            ${tabelaLinhas}
          </tbody>
        </table>
      </body>
    </html>
  `);

  janela.document.close();

  setTimeout(() => {
    janela.print();
  }, 500);
}