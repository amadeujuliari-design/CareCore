import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados';
import { abrirPreviewHtml } from './imprimirRelatorio';
import { obterLogoRelatorioSrc } from './relatorioIdentidadePrint';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function montarRodapeItens(identidadeRelatorio) {
  return [
    identidadeRelatorio?.relatorio_rodape_linha1,
    identidadeRelatorio?.relatorio_rodape_linha2,
    identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
    identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
    identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
  ].filter(Boolean);
}

export function montarHtmlResumoMensalAcompanhamentos({
  resumo,
  observacoes = {},
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
}) {
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const titulo = resumo?.titulo || 'RELATÓRIO MENSAL';
  const periodoRotulo = resumo?.periodo_rotulo || '';
  const geradoEm = resumo?.gerado_em
    ? new Date(resumo.gerado_em).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');
  const linhas = resumo?.linhas || [];

  const rodapeItens = montarRodapeItens(identidadeRelatorio);
  const rodapeHtml = rodapeItens.length
    ? rodapeItens.map((item) => `<div>${escaparHtml(item)}</div>`).join('')
    : '<div>Relatório gerado pelo CareCore+</div>';
  const urlDireitosReservados = obterUrlDireitosReservados();

  const linhasTabela = linhas
    .map((linha) => {
      const obs = observacoes[linha.acao] || linha.observacoes || '';
      return `
        <tr>
          <td class="col-acoes">${escaparHtml(linha.acao)}</td>
          <td class="col-num">${escaparHtml(linha.total)}</td>
          <td class="col-obs">${escaparHtml(obs)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <title>${escaparHtml(titulo)}</title>
        <style>
          @page {
            size: A4 portrait;
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

          .identidade-nome {
            margin-top: 8px;
            font-size: 12px;
            font-weight: 800;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .titulo-relatorio {
            text-align: right;
          }

          h1 {
            margin: 0 0 4px;
            font-size: 18px;
            text-transform: uppercase;
          }

          .subtitulo {
            margin: 0 0 4px;
            color: #374151;
            font-size: 12px;
            font-weight: 600;
          }

          .gerado {
            font-size: 11px;
            color: #6b7280;
          }

          .tabela-resumo {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .tabela-resumo th {
            background: #f3f4f6;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
          }

          .tabela-resumo th.col-num,
          .tabela-resumo td.col-num {
            text-align: center;
          }

          .tabela-resumo th,
          .tabela-resumo td {
            border: 1px solid #d1d5db;
            padding: 8px;
            font-size: 12px;
            vertical-align: top;
          }

          .tabela-resumo .col-acoes { width: 64%; }
          .tabela-resumo .col-num { width: 10%; font-weight: 700; }
          .tabela-resumo .col-obs {
            width: 26%;
            white-space: pre-wrap;
            word-break: break-word;
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
            .cabecalho-relatorio,
            .rodape-relatorio {
              break-inside: avoid;
            }

            tr {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <table class="pagina-relatorio">
          <thead>
            <tr>
              <th>
                <div class="cabecalho-relatorio">
                  <div>
                    <img class="logo-relatorio" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
                    <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
                  </div>
                  <div class="titulo-relatorio">
                    <h1>${escaparHtml(titulo)}</h1>
                    ${periodoRotulo ? `<div class="subtitulo">Período: ${escaparHtml(periodoRotulo)}</div>` : ''}
                    <div class="gerado">Gerado em: ${escaparHtml(geradoEm)}</div>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td>
                <div class="espaco-rodape"></div>
                <div class="rodape-relatorio">
                  ${rodapeHtml}
                  <div class="direitos-reservados">
                    <a href="${escaparHtml(urlDireitosReservados)}" target="_blank" rel="noopener noreferrer">
                      ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
                    </a>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
                <table class="tabela-resumo">
                  <thead>
                    <tr>
                      <th class="col-acoes">Ações</th>
                      <th class="col-num">Qtd.</th>
                      <th class="col-obs">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasTabela}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export function imprimirResumoMensalAcompanhamentos({
  resumo,
  observacoes = {},
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
}) {
  const html = montarHtmlResumoMensalAcompanhamentos({
    resumo,
    observacoes,
    identidadeRelatorio,
    logoRelatorioDataUrl,
  });

  abrirPreviewHtml({
    titulo: resumo?.titulo || 'Resumo mensal',
    html,
    orientacaoInicial: 'portrait',
  });
}
