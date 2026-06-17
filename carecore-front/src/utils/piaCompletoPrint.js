import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados';
import { obterLogoRelatorioSrc } from './relatorioIdentidadePrint';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarDataHora(valor) {
  if (!valor) return '-';

  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function blocoTexto(titulo, conteudo) {
  if (!conteudo) return '';

  return `
    <section class="bloco-texto">
      <h4>${escaparHtml(titulo)}</h4>
      <p>${escaparHtml(conteudo)}</p>
    </section>
  `;
}

function montarEvolucaoHtml(evolucao) {
  return `
    <article class="evolucao">
      <header class="registro-header">
        <div>
          <span class="tag tag-evolucao">Evolução</span>
          <h3>${escaparHtml(evolucao.subtitulo || 'Sem tema informado')}</h3>
        </div>
        <div class="registro-meta">
          <strong>${escaparHtml(formatarDataHora(evolucao.data_registro))}</strong>
          <span>${escaparHtml(evolucao.usuario_nome || 'Usuário')}</span>
        </div>
      </header>

      <div class="status-linha">
        <span>Status: ${escaparHtml(evolucao.status || '-')}</span>
      </div>

      ${blocoTexto('Descrição da evolução', evolucao.descricao)}
      ${blocoTexto('Objetivos / metas trabalhadas', evolucao.objetivos)}
      ${blocoTexto('Encaminhamentos e próximos passos', evolucao.encaminhamentos)}
    </article>
  `;
}

function montarPiaPrincipalHtml(registro, evolucoes = []) {
  return `
    <article class="pia-principal">
      <header class="registro-header">
        <div>
          <span class="tag">PIA principal</span>
          <h2>${escaparHtml(registro.titulo || 'Plano Individual de Atendimento')}</h2>
        </div>
        <div class="registro-meta">
          <strong>${escaparHtml(formatarDataHora(registro.data_registro))}</strong>
          <span>${escaparHtml(registro.usuario_nome || 'Usuário')}</span>
        </div>
      </header>

      <div class="status-linha">
        <span>Status: ${escaparHtml(registro.status || '-')}</span>
      </div>

      ${blocoTexto('Descrição inicial do plano', registro.descricao)}
      ${blocoTexto('Objetivos / metas', registro.objetivos)}
      ${blocoTexto('Encaminhamentos e próximos passos', registro.encaminhamentos)}

      <section class="evolucoes">
        <h3>Evoluções vinculadas (${evolucoes.length})</h3>
        ${
          evolucoes.length
            ? evolucoes.map(montarEvolucaoHtml).join('')
            : '<p class="vazio">Nenhuma evolução registrada para este PIA.</p>'
        }
      </section>
    </article>
  `;
}

function montarRodapeRelatorio(rodapeItens, direitosUrl) {
  return `
    <footer class="rodape-relatorio">
      ${
        rodapeItens.length
          ? rodapeItens.map((item) => `<div>${escaparHtml(item)}</div>`).join('')
          : '<div>Relatório gerado pelo CareCore+</div>'
      }
      <div class="direitos-reservados">
        <a href="${escaparHtml(direitosUrl)}" target="_blank" rel="noopener noreferrer">
          ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
        </a>
      </div>
    </footer>
  `;
}

function montarCabecalhoPia({
  convivente,
  listaTecnicos = [],
  logoSrc,
  nomeExibicao,
  titulo = 'Plano Individual de Atendimento',
  subtitulo = '',
}) {
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || 'Convivente';
  const tecnico = listaTecnicos.find((tec) => tec.id === convivente?.tecnico_id);

  return `
    <header class="cabecalho">
      <div>
        <img class="logo" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
        <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
      </div>
      <div class="titulo">
        <h1>${escaparHtml(titulo)}</h1>
        <p>Gerado em ${escaparHtml(new Date().toLocaleString('pt-BR'))}</p>
        ${subtitulo ? `<p>${escaparHtml(subtitulo)}</p>` : ''}
        <p><strong>${escaparHtml(nomeConvivente)}</strong></p>
      </div>
    </header>

    <section class="dados-convivente">
      <div class="dado"><span>Prontuário</span><strong>#${escaparHtml(convivente?.numero_institucional || 'S/N')}</strong></div>
      <div class="dado"><span>Status</span><strong>${escaparHtml(convivente?.status || '-')}</strong></div>
      <div class="dado"><span>Técnico</span><strong>${escaparHtml(tecnico?.nome || 'Sem técnico')}</strong></div>
      <div class="dado"><span>Nº SISA</span><strong>${escaparHtml(convivente?.numero_sisa || '-')}</strong></div>
    </section>
  `;
}

function estilosPiaCompleto() {
  return `
    @page { size: A4; margin: 12mm 10mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #ffffff; }
    .cabecalho { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 18px; }
    .logo { width: 180px; max-height: 64px; object-fit: contain; }
    .identidade-nome { margin-top: 6px; color: #374151; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .titulo { text-align: right; }
    h1 { margin: 0; font-size: 22px; }
    .titulo p { margin: 4px 0; color: #6b7280; font-size: 12px; }
    .dados-convivente { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
    .dado { border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px; background: #f9fafb; }
    .dado span { display: block; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; }
    .dado strong { display: block; margin-top: 3px; font-size: 12px; color: #111827; }
    .pia-principal { border: 1px solid #dbeafe; border-radius: 16px; padding: 16px; margin-bottom: 18px; page-break-inside: avoid; background: #ffffff; }
    .registro-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 12px; }
    .registro-header h2, .registro-header h3 { margin: 7px 0 0; color: #111827; }
    .registro-header h2 { font-size: 18px; }
    .registro-header h3 { font-size: 14px; }
    .registro-meta { text-align: right; color: #475569; font-size: 11px; }
    .registro-meta span { display: block; margin-top: 3px; font-weight: 700; }
    .tag { display: inline-flex; border-radius: 999px; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 4px 9px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .tag-evolucao { background: #ecfeff; color: #155e75; border-color: #a5f3fc; }
    .status-linha { margin-bottom: 10px; }
    .status-linha span { display: inline-flex; border-radius: 999px; background: #f3f4f6; color: #374151; padding: 4px 10px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .bloco-texto { margin: 10px 0; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #fafafa; }
    .bloco-texto h4 { margin: 0 0 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #0f766e; }
    .bloco-texto p { margin: 0; white-space: pre-wrap; color: #374151; font-size: 12px; line-height: 1.45; }
    .evolucoes { margin-top: 16px; border-left: 3px solid #c7d2fe; padding-left: 14px; }
    .evolucoes > h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #4338ca; }
    .evolucao { border: 1px solid #e0e7ff; border-radius: 14px; padding: 12px; margin-bottom: 12px; background: #f8fafc; page-break-inside: avoid; }
    .vazio { margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; }
    .rodape-relatorio { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 10px; line-height: 1.4; text-align: center; }
    .direitos-reservados { margin-top: 5px; font-size: 9px; font-weight: 700; }
    .direitos-reservados a { color: #4f46e5; text-decoration: none; }
    .quebra-pia { break-after: page; page-break-after: always; }
    .quebra-pia:last-child { break-after: auto; page-break-after: auto; }
    .quebra-pia .pia-principal:last-child { margin-bottom: 0; }
    @media print {
      body { padding: 0; }
      .cabecalho { margin-bottom: 12px; padding-bottom: 9px; }
      .logo { width: 135px; max-height: 48px; }
      h1 { font-size: 18px; }
      .dados-convivente { gap: 6px; margin-bottom: 10px; }
      .dado { padding: 6px; border-radius: 7px; }
      .dado strong { font-size: 10px; }
      .pia-principal { padding: 10px; margin-bottom: 12px; border-radius: 10px; }
      .registro-header { padding-bottom: 7px; margin-bottom: 8px; }
      .bloco-texto { padding: 7px; margin: 7px 0; }
      .bloco-texto p { font-size: 10px; line-height: 1.3; }
      .evolucao { padding: 8px; margin-bottom: 8px; }
    }
  `;
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

export function montarHtmlPiaCompleto({
  convivente,
  registrosPiaPrincipais = [],
  evolucoesPorRegistroPia = {},
  listaTecnicos = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
}) {
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || 'Convivente';
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const direitosUrl = obterUrlDireitosReservados();
  const rodapeItens = montarRodapeItens(identidadeRelatorio);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PIA completo - ${escaparHtml(nomeConvivente)}</title>
        <style>
          ${estilosPiaCompleto()}
        </style>
      </head>
      <body>
        ${montarCabecalhoPia({ convivente, listaTecnicos, logoSrc, nomeExibicao })}

        ${
          registrosPiaPrincipais.length
            ? registrosPiaPrincipais.map((registro) => montarPiaPrincipalHtml(
              registro,
              evolucoesPorRegistroPia[registro.id] || [],
            )).join('')
            : '<p class="vazio">Nenhum PIA principal registrado para este convivente.</p>'
        }

        ${montarRodapeRelatorio(rodapeItens, direitosUrl)}
      </body>
    </html>
  `;
}

export function montarHtmlPiasCompletosLote({
  itens = [],
  listaTecnicos = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  descricaoFiltros = '',
}) {
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PIAs completos filtrados</title>
        <style>
          ${estilosPiaCompleto()}
        </style>
      </head>
      <body>
        ${itens.map((item) => `
          <section class="quebra-pia">
            ${montarCabecalhoPia({
              convivente: item.convivente,
              listaTecnicos,
              logoSrc,
              nomeExibicao,
              titulo: 'PIA completo filtrado',
              subtitulo: descricaoFiltros,
            })}
            ${
              item.registrosPiaPrincipais.length
                ? item.registrosPiaPrincipais.map((registro) => montarPiaPrincipalHtml(
                  registro,
                  item.evolucoesPorRegistroPia[registro.id] || [],
                )).join('')
                : '<p class="vazio">Nenhum PIA principal registrado para este convivente.</p>'
            }
          </section>
        `).join('')}
      </body>
    </html>
  `;
}
