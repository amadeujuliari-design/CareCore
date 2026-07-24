import { abrirPreviewHtml } from './imprimirRelatorio.js';
import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
  obterLogoRelatorioSrc,
} from './relatorioIdentidadePrint.js';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados.js';
import {
  formatarDataBr,
  formatarEvolucoesTexto,
  montarFiltrosRotuloPot,
  montarItensRodapeIdentidade,
} from './potListaExportPrintHelpers.js';

export { montarFiltrosRotuloPot, montarItensRodapeIdentidade };

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportarPotXlsx({
  items = [],
  filtros = {},
  truncado = false,
  incluirEvolucoes = true,
} = {}) {
  const dados = items.map((item) => {
    const linha = {
      Convivente: item.convivente_nome || '',
      Prontuário: item.prontuario || '',
      Status: item.status_convivente || '',
      Inserção: formatarDataBr(item.data_insercao),
      Atividade: item.atividade || '',
      Local: item.local || '',
      Referência: item.tecnico_referencia || '',
      Indicação: item.indicacao || '',
      Situação: item.situacao_atual || '',
      Desligamento: formatarDataBr(item.data_desligamento),
      Observações: item.observacoes || '',
    };
    if (incluirEvolucoes) {
      linha.Evoluções = formatarEvolucoesTexto(item.evolucoes || []);
    }
    return linha;
  });

  const colunas = [
    'Convivente',
    'Prontuário',
    'Status',
    'Inserção',
    'Atividade',
    'Local',
    'Referência',
    'Indicação',
    'Situação',
    'Desligamento',
    'Observações',
  ];
  if (incluirEvolucoes) colunas.push('Evoluções');

  return exportarRelatorioXlsx({
    nomeArquivo: `pot-${new Date().toISOString().slice(0, 10)}`,
    titulo: truncado
      ? 'Programa Operação Trabalho (lista truncada no limite de exportação)'
      : 'Programa Operação Trabalho',
    filtros,
    colunas,
    dados,
  });
}

export function montarHtmlPotLista({
  items = [],
  filtros = {},
  geradoEm = '',
  truncado = false,
  incluirEvolucoes = true,
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
} = {}) {
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const urlDireitos = obterUrlDireitosReservados();
  const rodapeItens = montarItensRodapeIdentidade(identidadeRelatorio);
  const rodapeClienteHtml = rodapeItens.length
    ? rodapeItens.map((item) => `<div>${escaparHtml(item)}</div>`).join('')
    : '<div>Relatório gerado pelo CareCore+</div>';

  const filtrosHtml = Object.entries(filtros)
    .map(([chave, valor]) => `<div><strong>${escaparHtml(chave)}:</strong> ${escaparHtml(valor)}</div>`)
    .join('');

  const blocos = items.map((item) => {
    const evolucoes = item.evolucoes || [];
    const evolucoesHtml = !incluirEvolucoes
      ? ''
      : evolucoes.length
        ? `<h3>Evoluções</h3><ul class="evo">${evolucoes.map((evo) => `
          <li>
            <strong>${escaparHtml(evo.status_evolucao || '-')}</strong>
            · ${escaparHtml(formatarDataBr(evo.data_evolucao))}
            ${evo.observacoes ? `<div class="obs">${escaparHtml(evo.observacoes)}</div>` : ''}
          </li>
        `).join('')}</ul>`
        : '<h3>Evoluções</h3><p class="sem-evo">Nenhuma evolução registrada.</p>';

    return `
      <section class="bloco">
        <h2>${escaparHtml(item.convivente_nome || 'Convivente')}</h2>
        <div class="meta">
          Prontuário: ${escaparHtml(item.prontuario || '-')}
          · Status: ${escaparHtml(item.status_convivente || '-')}
          · Situação: ${escaparHtml(item.situacao_atual || '-')}
        </div>
        <div class="meta">
          Inserção: ${escaparHtml(formatarDataBr(item.data_insercao))}
          · Local: ${escaparHtml(item.local || '-')}
          · Atividade: ${escaparHtml(item.atividade || '-')}
        </div>
        <div class="meta">
          Referência: ${escaparHtml(item.tecnico_referencia || '-')}
          · Indicação: ${escaparHtml(item.indicacao || '-')}
          · Desligamento: ${escaparHtml(formatarDataBr(item.data_desligamento))}
        </div>
        ${item.observacoes ? `<p class="obs"><strong>Observações:</strong> ${escaparHtml(item.observacoes)}</p>` : ''}
        ${evolucoesHtml}
      </section>
    `;
  }).join('');

  const gerado = geradoEm || new Date().toLocaleString('pt-BR');

  return `
    <html>
      <head>
        <title>POT — lista filtrada</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm 16mm; }

          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
          }

          .pagina-relatorio {
            width: 100%;
            border-collapse: collapse;
          }

          .pagina-relatorio > thead { display: table-header-group; }
          .pagina-relatorio > tfoot { display: table-footer-group; }

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
            margin-bottom: 12px;
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

          .titulo-relatorio { text-align: right; }

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

          .filtros {
            font-size: 11px;
            margin: 0 0 12px;
            border: 1px solid #e2e8f0;
            padding: 8px;
          }

          .aviso {
            font-size: 11px;
            color: #b45309;
            margin-bottom: 8px;
          }

          .bloco {
            border-top: 1px solid #cbd5e1;
            padding: 10px 0;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          h2 { font-size: 13px; margin: 0 0 4px; }
          h3 { font-size: 11px; margin: 8px 0 4px; }
          .meta { font-size: 11px; color: #334155; margin: 2px 0; }
          .obs { font-size: 11px; white-space: pre-wrap; margin: 6px 0; }
          .evo { margin: 0; padding-left: 16px; font-size: 11px; }
          .evo li { margin-bottom: 4px; }
          .sem-evo { font-size: 11px; color: #64748b; margin: 0; }

          .espaco-rodape { height: 10px; }

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

          @media print {
            .cabecalho-relatorio,
            .rodape-relatorio,
            .bloco {
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
                    <h1>Programa Operação Trabalho</h1>
                    <div class="subtitulo">Lista filtrada</div>
                    <div class="gerado">Gerado em: ${escaparHtml(gerado)}</div>
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
                  ${rodapeClienteHtml}
                  <div class="direitos-reservados">
                    <a href="${escaparHtml(urlDireitos)}" target="_blank" rel="noopener noreferrer">
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
                ${truncado ? '<div class="aviso">Lista truncada no limite de exportação. Refine os filtros se necessário.</div>' : ''}
                <div class="filtros">${filtrosHtml || '<div>Sem filtros adicionais</div>'}</div>
                ${blocos || '<p>Nenhum registro no filtro atual.</p>'}
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export async function imprimirPotLista(opcoes = {}) {
  let identidadeRelatorio = opcoes.identidadeRelatorio || null;
  let logoRelatorioDataUrl = opcoes.logoRelatorioDataUrl || '';

  if (!identidadeRelatorio) {
    identidadeRelatorio = await buscarIdentidadeRelatorios();
  }
  if (!logoRelatorioDataUrl) {
    logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  }

  const html = montarHtmlPotLista({
    ...opcoes,
    identidadeRelatorio,
    logoRelatorioDataUrl,
  });
  abrirPreviewHtml({
    titulo: 'POT — lista filtrada',
    html,
    orientacaoInicial: 'portrait',
  });
}
