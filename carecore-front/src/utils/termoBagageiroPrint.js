import {
  TERMO_BAGAGEIRO_COMPROMISSO,
  TERMO_BAGAGEIRO_ITENS,
  TERMO_BAGAGEIRO_RETIRADA_SUBTITULO,
  TERMO_BAGAGEIRO_RETIRADA_TEXTO,
  TERMO_BAGAGEIRO_RETIRADA_TITULO,
  TERMO_BAGAGEIRO_TITULO,
} from '../config/termoBagageiroTexto';
import { montarConfigOperacionalPadrao } from '../config/configOperacionalDefaults';
import { obterLogoRelatorioSrc } from './relatorioIdentidadePrint';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados';
import { formatarDataBr } from './dataBrasilUtils.js';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dataBr(valor) {
  if (!valor) return '';
  return formatarDataBr(valor) || '';
}

function montarHtmlAssinaturaDigital(assinaturaDigital) {
  if (!assinaturaDigital) return '';

  const linhas = [];
  if (Array.isArray(assinaturaDigital.linhas) && assinaturaDigital.linhas.length) {
    linhas.push(...assinaturaDigital.linhas);
  } else {
    const metodo = assinaturaDigital.metodo_leitura
      || (String(assinaturaDigital.codigo_lido || '').includes('-') ? 'qr_code' : 'codigo_barras');
    linhas.push('Assinado Digitalmente');
    if (metodo === 'qr_code') {
      linhas.push(`Código: ${assinaturaDigital.codigo_lido}`);
      if (assinaturaDigital.numero_prontuario) {
        linhas.push(`Prontuário #${assinaturaDigital.numero_prontuario}`);
      }
    } else if (assinaturaDigital.codigo_lido) {
      linhas.push(`Código: ${assinaturaDigital.codigo_lido}`);
    }
    if (assinaturaDigital.assinado_em) {
      try {
        linhas.push(new Date(assinaturaDigital.assinado_em).toLocaleString('pt-BR'));
      } catch {
        // ignore
      }
    }
  }

  return `
    <div class="assinatura-digital-texto">
      ${linhas.map((linha) => `<div>${escaparHtml(linha)}</div>`).join('')}
    </div>
  `;
}

function montarBlocoAssinatura(rotulo, assinaturaDigital, ehConvivente = false) {
  const conteudo = ehConvivente && assinaturaDigital
    ? montarHtmlAssinaturaDigital(assinaturaDigital)
    : '<div class="assinatura-espaco"></div>';

  return `
    <div class="assinatura-bloco">
      ${conteudo}
      <div class="assinatura-traco"></div>
      <div class="assinatura-rotulo">${escaparHtml(rotulo)}</div>
    </div>
  `;
}

function estilosTermoBagageiro() {
  return `
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
    ol.termo-itens {
      margin: 0 0 10px 18px;
      padding: 0;
    }
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
    .obs-label {
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 8px;
    }
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
    @media screen {
      body { background: #e5e7eb; padding: 16px 0; }
      .pagina {
        background: #fff;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        padding: 12mm;
      }
    }
  `;
}

export function montarHtmlTermoBagageiro({
  convivente,
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  assinaturaDigital = null,
  nomeFuncionario = '',
  configOperacional = null,
}) {
  const configBase = configOperacional || montarConfigOperacionalPadrao();
  const bagageiro = configBase.documentos?.termo_bagageiro || {};
  const titulo = bagageiro.titulo || TERMO_BAGAGEIRO_TITULO;
  const itens = (bagageiro.itens?.length ? bagageiro.itens : TERMO_BAGAGEIRO_ITENS);
  const compromisso = bagageiro.compromisso || TERMO_BAGAGEIRO_COMPROMISSO;
  const retiradaTitulo = bagageiro.retirada_titulo || TERMO_BAGAGEIRO_RETIRADA_TITULO;
  const retiradaSubtitulo = bagageiro.retirada_subtitulo || TERMO_BAGAGEIRO_RETIRADA_SUBTITULO;
  const retiradaTexto = bagageiro.retirada_texto || TERMO_BAGAGEIRO_RETIRADA_TEXTO;
  const rotuloFuncionario = bagageiro.rotulo_assinatura_funcionario || 'Funcionário SIAT II Armênia';

  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || '';
  const prontuario = convivente?.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N';
  const dataHoje = dataBr(new Date().toISOString());

  const itensHtml = itens.map(
    (item, index) => `<li value="${index + 1}">${escaparHtml(item)}</li>`,
  ).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${escaparHtml(titulo)} - ${escaparHtml(nomeConvivente)}</title>
        <style>${estilosTermoBagageiro()}</style>
      </head>
      <body>
        <section class="pagina">
          <div class="corpo-termo">
          <div class="cabecalho">
            ${logoSrc ? `<img src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />` : `<strong>${escaparHtml(nomeExibicao)}</strong>`}
            <strong style="font-size:11px;color:#1e3a8a;">CARECORE+</strong>
          </div>

          <h1 class="titulo">${escaparHtml(titulo)}</h1>

          <div class="convivente-resumo">
            <div><strong>Nome</strong><br>${escaparHtml(nomeConvivente)}</div>
            <div><strong>Prontuário</strong><br>${escaparHtml(prontuario)}</div>
            <div><strong>CPF</strong><br>${escaparHtml(convivente?.cpf || 'Não informado')}</div>
            <div><strong>Data</strong><br>${escaparHtml(dataHoje)}</div>
          </div>

          <ol class="termo-itens" type="I">${itensHtml}</ol>

          <p class="compromisso">${escaparHtml(compromisso)}</p>

          <div class="campos-linha">
            <div class="campo-linha">
              <label>Nome</label>
              <div class="linha">${escaparHtml(nomeConvivente)}</div>
            </div>
            <div class="campo-linha">
              <label>Data</label>
              <div class="linha">${escaparHtml(dataHoje)}</div>
            </div>
          </div>

          <div class="campos-linha">
            <div class="campo-linha">
              <label>Funcionário</label>
              <div class="linha">${escaparHtml(nomeFuncionario)}</div>
            </div>
            <div></div>
          </div>

          <div class="assinaturas">
            ${montarBlocoAssinatura('Assinatura do atendido', assinaturaDigital, true)}
            ${montarBlocoAssinatura(rotuloFuncionario, null, false)}
          </div>
          </div>

          <div class="secao-retirada">
            <h3>${escaparHtml(retiradaTitulo)}</h3>
            <p>${escaparHtml(retiradaSubtitulo)}</p>
            <p>${escaparHtml(retiradaTexto)}</p>
            <div class="obs-label">OBS:</div>
            <div class="obs-linha"></div>
            <div class="assinaturas assinaturas-compactas">
              ${montarBlocoAssinatura('Assinatura do atendido', null, false)}
              ${montarBlocoAssinatura(rotuloFuncionario, null, false)}
            </div>
          </div>

          <div class="rodape">
            ${escaparHtml(nomeExibicao)} · ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
            · <a href="${escaparHtml(obterUrlDireitosReservados())}">Direitos reservados</a>
          </div>
        </section>
      </body>
    </html>
  `;
}

export function montarHtmlTermoBagageiroLote({
  conviventes = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  assinaturasPorConvivente = {},
  nomeFuncionario = '',
  configOperacional = null,
}) {
  const paginas = conviventes.map((convivente) => {
    const html = montarHtmlTermoBagageiro({
      convivente,
      identidadeRelatorio,
      logoRelatorioDataUrl,
      assinaturaDigital: assinaturasPorConvivente[convivente.id] || null,
      nomeFuncionario,
      configOperacional,
    });
    const match = html.match(/<section class="pagina">[\s\S]*<\/section>/);
    return match ? match[0] : '';
  }).filter(Boolean);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${escaparHtml(TERMO_BAGAGEIRO_TITULO)}</title>
        <style>${estilosTermoBagageiro()}</style>
      </head>
      <body>
        ${paginas.join('\n')}
      </body>
    </html>
  `;
}
