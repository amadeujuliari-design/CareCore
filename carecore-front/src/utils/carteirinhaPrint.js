/**
 * Impressão de carteirinhas em documento isolado (iframe).
 * Nunca usa window.print() na página principal — evita páginas em branco.
 */

import { gerarHtmlCarteirinhaUnitaria, resolverDadosCarteirinha } from './carteirinhaDados';
import { obterTokenLocal } from '../services/api';
import { API_ROOT } from '../config/apiBase';
import axios from 'axios';
import { urlArquivoBackend } from './arquivosApi';
import { criarHeadersAutenticados, criarHeadersCareCore } from './requestIdUtils';
import logoCarecore from '../assets/logo.PNG';

export async function registrarImpressaoCarteirinhaOficial(
  conviventeId,
  { quantidade = 1, origem = 'unitaria' } = {},
) {
  if (!conviventeId) return null;
  const token = obterTokenLocal();
  const resposta = await axios.post(
    `${API_ROOT}/carteirinha/conviventes/${conviventeId}/impressao-oficial`,
    { quantidade, origem },
    { headers: criarHeadersAutenticados(token) },
  );
  return resposta.data;
}

async function urlImagemParaDataUrl(url) {
  if (!url) return '';

  let headers = criarHeadersCareCore();
  if (url.includes('/api/arquivos/')) {
    const token = obterTokenLocal();
    headers = criarHeadersAutenticados(token);
  }

  const resposta = await fetch(url, { headers });
  if (!resposta.ok) return '';

  const blob = await resposta.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

function imprimirHtmlNoIframe(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const limpar = () => {
      iframe.remove();
      resolve();
    };

    const janela = iframe.contentWindow;
    const doc = iframe.contentDocument;

    if (!janela || !doc) {
      limpar();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const disparar = () => {
      window.setTimeout(() => {
        janela.focus();
        janela.print();
        janela.addEventListener('afterprint', limpar, { once: true });
        window.setTimeout(limpar, 5000);
      }, 400);
    };

    if (doc.readyState === 'complete') {
      disparar();
    } else {
      iframe.onload = disparar;
    }
  });
}

function extrairSvgsDoPreview(elemento) {
  if (!elemento) return { qrSvgHtml: '', barcodeSvgHtml: '' };
  const svgs = elemento.querySelectorAll('svg');
  return {
    qrSvgHtml: svgs[0]?.outerHTML || '',
    barcodeSvgHtml: svgs[1]?.outerHTML || '',
  };
}

function extrairBodyHtml(html) {
  return html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]?.trim() || '';
}

function extrairStyleHtml(html) {
  const style = html.match(/<style[^>]*>([\s\S]*)<\/style>/i)?.[1]?.trim() || '';

  return style
    .replace(/html,\s*body\s*\{[\s\S]*?\}\s*/i, '')
    .replace(/@page\s*\{[\s\S]*?\}\s*/i, '');
}

async function montarHtmlCarteirinhaDeConvivente(
  convivente,
  quartos,
  tecnicos,
  fotoCaminho,
  domId,
  identidadeRelatorio = null,
) {
  const elemento = domId ? document.getElementById(domId) : null;
  const dados = resolverDadosCarteirinha(convivente, quartos, tecnicos, fotoCaminho);
  if (!dados) return '';

  const { qrSvgHtml, barcodeSvgHtml } = extrairSvgsDoPreview(elemento);

  let fotoDataUrl = '';
  const img = elemento?.querySelector('img[data-carteirinha-foto="true"]');
  if (img?.src) {
    fotoDataUrl = await urlImagemParaDataUrl(img.src);
  }

  let logoProjetoDataUrl = '';
  const logoProjetoUrl = identidadeRelatorio?.relatorio_logo_url
    ? urlArquivoBackend(identidadeRelatorio.relatorio_logo_url)
    : '';
  if (logoProjetoUrl) {
    logoProjetoDataUrl = await urlImagemParaDataUrl(logoProjetoUrl);
  }

  const logoCarecoreDataUrl = await urlImagemParaDataUrl(logoCarecore);

  const doc = gerarHtmlCarteirinhaUnitaria(dados, {
    fotoDataUrl,
    qrSvgHtml,
    barcodeSvgHtml,
    logoProjetoDataUrl,
    logoCarecoreDataUrl,
    nomeProjeto: identidadeRelatorio?.relatorio_nome_exibicao || 'Projeto',
  });

  return doc;
}

/** Impressão unitária a partir do modal no cadastro do convivente. */
export async function imprimirCarteirinhaUnitaria({
  convivente,
  quartos = [],
  tecnicos = [],
  fotoCaminho = null,
  identidadeRelatorio = null,
  onImpresso = null,
}) {
  const html = await montarHtmlCarteirinhaDeConvivente(
    convivente,
    quartos,
    tecnicos,
    fotoCaminho,
    'area-cracha',
    identidadeRelatorio,
  );

  if (!html) return;

  await imprimirHtmlNoIframe(html);

  try {
    const resultado = await registrarImpressaoCarteirinhaOficial(convivente?.id, { origem: 'unitaria' });
    onImpresso?.(resultado);
  } catch (erro) {
    console.error('Falha ao registrar impressão oficial da carteirinha', erro);
  }
}

/** Impressão em lote — aba Carteirinhas da central de relatórios. */
export async function imprimirCarteirinhasLote({
  conviventes = [],
  quartos = [],
  tecnicos = [],
  orientacao = 'portrait',
  porFolha = 6,
  colunas = 3,
  escala = 0.9,
  guiasCorte = true,
  identidadeRelatorio = null,
  onImpresso = null,
}) {
  if (!conviventes.length) return;

  const orient = orientacao === 'landscape' ? 'landscape' : 'portrait';
  const pagina = orient === 'landscape'
    ? {
        largura: '297mm',
        altura: '210mm',
        larguraUtil: '282mm',
        alturaUtil: '194mm',
      }
    : {
        largura: '210mm',
        altura: '297mm',
        larguraUtil: '194mm',
        alturaUtil: '282mm',
      };
  const larguraCard = `calc(70mm * ${escala})`;
  const alturaCard = `calc(100mm * ${escala})`;
  const folhas = [];
  let estiloCarteirinha = '';

  for (let i = 0; i < conviventes.length; i += porFolha) {
    const grupo = conviventes.slice(i, i + porFolha);
    const cards = [];

    for (const convivente of grupo) {
      const cardHtml = await montarHtmlCarteirinhaDeConvivente(
        convivente,
        quartos,
        tecnicos,
        null,
        `carteirinha-${convivente.id}`,
        identidadeRelatorio,
      );

      if (!estiloCarteirinha) {
        estiloCarteirinha = extrairStyleHtml(cardHtml);
      }

      const bodyHtml = extrairBodyHtml(cardHtml);
      if (!bodyHtml) continue;

      cards.push(`
        <div style="width:${larguraCard};height:${alturaCard};overflow:hidden;outline:${guiasCorte ? '1px dashed #cbd5e1' : 'none'};">
          <div style="transform:scale(${escala});transform-origin:top left;width:70mm;height:100mm;">
            ${bodyHtml}
          </div>
        </div>
      `);
    }

    folhas.push(`
      <div class="folha" style="width:${pagina.larguraUtil};height:${pagina.alturaUtil};display:grid;grid-template-columns:repeat(${colunas}, ${larguraCard});grid-auto-rows:${alturaCard};gap:4mm;justify-content:center;align-content:start;page-break-after:always;padding:2mm;overflow:hidden;">
        ${cards.join('')}
      </div>
    `);
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Carteirinhas CareCore+</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; }
    @page { size: ${pagina.largura} ${pagina.altura}; margin: 6mm; }
    ${estiloCarteirinha}
    .folha { page-break-after: always; break-after: page; }
    .folha:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      html, body { width: auto; min-height: auto; }
      .folha {
        width: ${pagina.larguraUtil} !important;
        height: ${pagina.alturaUtil} !important;
      }
    }
  </style>
</head>
<body>${folhas.join('')}</body>
</html>`;

  await imprimirHtmlNoIframe(html);

  for (const convivente of conviventes) {
    try {
      const resultado = await registrarImpressaoCarteirinhaOficial(convivente.id, { origem: 'lote' });
      onImpresso?.(convivente.id, resultado);
    } catch (erro) {
      console.error('Falha ao registrar impressão oficial da carteirinha', convivente.id, erro);
    }
  }
}
