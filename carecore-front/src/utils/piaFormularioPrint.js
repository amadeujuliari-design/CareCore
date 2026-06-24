import {
  TERMO_COMPROMISSO_TEXTO,
  TERMO_LGPD_SUBTITULO,
  TERMO_LGPD_TEXTO,
  TERMO_LGPD_TITULO,
} from '../config/piaTemplatesTexto';
import {
  RELACAO_FAMILIAR_SITUACOES,
  SUBSTANCIAS_PIA,
} from '../config/piaFichaConfig';
import { obterLogoRelatorioSrc } from './relatorioIdentidadePrint';
import { montarEnderecoFamiliarResumo } from './conviventesProntuarioUtils';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados';

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
  try {
    const data = String(valor).includes('T') ? new Date(valor) : new Date(`${valor}T00:00:00`);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function valorTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function boolSimNao(valor) {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return '';
}

function campoValor(valor, modo = 'manual') {
  const texto = valorTexto(valor);
  if (texto) return escaparHtml(texto);
  if (modo === 'manual') return '<span class="linha-preenchimento"></span>';
  return '-';
}

function campoValorCadastro(valor) {
  const texto = valorTexto(valor);
  if (texto) return escaparHtml(texto);
  return '<span class="linha-preenchimento"></span>';
}

function rotuloEhAssinaturaConvivente(rotulo = '') {
  return /convivente/i.test(String(rotulo));
}

function montarHtmlAssinaturaDigitalConteudo(assinaturaDigital) {
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
    } else {
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

function campoMultilinha(valor, modo = 'manual', linhas = 3) {
  const texto = valorTexto(valor);
  if (texto) return `<div class="valor-multilinha">${escaparHtml(texto)}</div>`;
  if (modo === 'manual') {
    return `<div class="linhas-manuais">${Array.from({ length: linhas }).map(() => '<span class="linha-preenchimento"></span>').join('')}</div>`;
  }
  return '<div class="valor-multilinha">-</div>';
}

function obterLabelOrigem(origemId, origensEncaminhamento = []) {
  if (!origemId) return '';
  const origem = normalizarLista(origensEncaminhamento).find((item) => item?.id === origemId);
  return origem?.descricao || origem?.nome || origem?.label || '';
}

function obterNomeTecnico(tecnicoId, listaTecnicos = []) {
  if (!tecnicoId) return '';
  const tecnico = normalizarLista(listaTecnicos).find((item) => item?.id === tecnicoId);
  return tecnico?.nome || '';
}

function relacaoFamiliarLabel(valor, outra = '') {
  const opcao = RELACAO_FAMILIAR_SITUACOES.find((item) => item.value === valor);
  if (!opcao) return valorTexto(valor);
  if (valor === 'outra') {
    const detalhe = valorTexto(outra);
    return detalhe ? `${opcao.label}: ${detalhe}` : opcao.label;
  }
  return opcao.label;
}

function temConteudoLinha(item = {}, campos = []) {
  return campos.some((campo) => valorTexto(item?.[campo]));
}

function montarCabecalhoPagina({
  convivente,
  logoSrc,
  nomeExibicao,
  numeroPagina,
  totalPaginas = 8,
  tituloPagina,
  dataInicialPia,
  nomeTecnico,
  modo = 'manual',
}) {
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || 'Convivente';
  const prontuario = convivente?.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N';
  const geradoEm = new Date().toLocaleString('pt-BR');

  return `
    <header class="cabecalho">
      <div class="cabecalho-left">
        <img class="logo" src="${escaparHtml(logoSrc)}" alt="${escaparHtml(nomeExibicao)}" />
        <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
      </div>
      <div class="cabecalho-right">
        <h1>FORMULÁRIO OFICIAL PIA</h1>
        <p>Plano Individual de Atendimento - Pacote institucional</p>
        <p><strong>${escaparHtml(nomeConvivente)}</strong> | Prontuário ${escaparHtml(prontuario)}</p>
        <p>Data inicial do PIA: <strong>${campoValor(dataInicialPia, modo)}</strong></p>
        <p>Técnico de referência: <strong>${campoValor(nomeTecnico, modo)}</strong></p>
        <p class="meta-pagina">Página ${escaparHtml(numeroPagina)} de ${escaparHtml(totalPaginas)} | ${escaparHtml(tituloPagina)} | Gerado em ${escaparHtml(geradoEm)}</p>
      </div>
    </header>
  `;
}

function montarRodapePagina(identidadeRelatorio) {
  const itens = [
    identidadeRelatorio?.relatorio_rodape_linha1,
    identidadeRelatorio?.relatorio_rodape_linha2,
    identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
    identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
    identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
  ].filter(Boolean);
  const direitosUrl = obterUrlDireitosReservados();

  return `
    <footer class="rodape-relatorio pagina-rodape">
      ${
        itens.length
          ? itens.map((item) => `<div>${escaparHtml(item)}</div>`).join('')
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

function montarPaginaPia(conteudoCorpo, rodapeHtml, opcoes = {}) {
  const classeExtra = opcoes.classeExtra ? ` ${opcoes.classeExtra}` : '';
  return `
    <section class="pagina${classeExtra}">
      <div class="pagina-corpo">${conteudoCorpo}</div>
      ${rodapeHtml}
    </section>
  `;
}

function destacarTermosLgpd(texto) {
  return escaparHtml(texto)
    .replace(/\bAUTORIZO\b/g, '<strong class="destaque-termo">AUTORIZO</strong>')
    .replace(/\bCONSENTIMENTO\b/g, '<strong class="destaque-termo">CONSENTIMENTO</strong>');
}

function formatarTextoTermoCompromissoHtml(texto) {
  const normalizado = String(texto || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const linhas = normalizado.split('\n').map((linha) => linha.trim()).filter(Boolean);
  if (!linhas.length) return '';

  return `
    <div class="paragrafos-termo-fluxo">
      ${linhas.map((linha) => `<p class="paragrafo-termo">${escaparHtml(linha)}</p>`).join('')}
    </div>
  `;
}

function montarRodapeFormularioLgpd(convivente, modo = 'manual', assinaturaDigital = null) {
  const nomeExibicao = convivente?.nome_completo || convivente?.nome_social || '';
  const assinaturaHtml = assinaturaDigital
    ? montarHtmlAssinaturaDigitalConteudo(assinaturaDigital)
    : '<div class="linha-assinatura-lgpd"></div>';

  return `
    <div class="rodape-lgpd-formulario">
      <p class="data-lgpd">
        São Paulo, <span class="linha-data-lgpd curta">${modo === 'completo' ? escaparHtml(String(new Date().getDate()).padStart(2, '0')) : ''}</span>
        de <span class="linha-data-lgpd media">${modo === 'completo' ? escaparHtml(new Date().toLocaleString('pt-BR', { month: 'long' })) : ''}</span>
        de <span class="linha-data-lgpd curta">${modo === 'completo' ? escaparHtml(String(new Date().getFullYear())) : ''}</span>.
      </p>
      <div class="grid-lgpd-assinatura">
        <div class="campo-lgpd">
          <span class="label-lgpd">NOME COMPLETO (Se menor, inserir o nome do responsável):</span>
          <div class="valor-lgpd">${campoValorCadastro(nomeExibicao)}</div>
        </div>
        <div class="campo-lgpd">
          <span class="label-lgpd">RG:</span>
          <div class="valor-lgpd">${campoValorCadastro(convivente?.rg)}</div>
        </div>
        <div class="campo-lgpd">
          <span class="label-lgpd">ASSINATURA PARA AUTORIZAÇÃO (Se menor, assina o nome do responsável):</span>
          ${assinaturaHtml}
        </div>
      </div>
    </div>
  `;
}

function montarConteudoPaginaLgpd(convivente, modo = 'manual', assinaturaDigital = null) {
  return `
    <div class="secao secao-lgpd">
      <h2 class="titulo-lgpd">${escaparHtml(TERMO_LGPD_TITULO)}</h2>
      <h3 class="subtitulo-lgpd">${escaparHtml(TERMO_LGPD_SUBTITULO)}</h3>
      <p class="texto-lgpd-corpo">${destacarTermosLgpd(TERMO_LGPD_TEXTO)}</p>
    </div>
    ${montarRodapeFormularioLgpd(convivente, modo, assinaturaDigital)}
  `;
}

function montarBlocoAssinaturas(rotulos = [], opcoes = {}) {
  const itens = normalizarLista(rotulos).filter(Boolean);
  if (!itens.length) return '';
  const assinaturaDigital = opcoes.assinaturaDigital || null;

  const classeBloco = opcoes.termo
    ? 'bloco-assinaturas-pagina bloco-assinaturas-termo'
    : 'bloco-assinaturas-pagina';

  return `
    <div class="${classeBloco}">
      <div class="assinaturas">
        ${itens.map((rotulo) => {
          const ehConvivente = rotuloEhAssinaturaConvivente(rotulo);
          const conteudoDigital = ehConvivente && assinaturaDigital
            ? montarHtmlAssinaturaDigitalConteudo(assinaturaDigital)
            : '';
          return `
          <div class="assinatura-bloco">
            <div class="assinatura-espaco" aria-hidden="true">${conteudoDigital}</div>
            <div class="assinatura-traco"></div>
            <div class="assinatura-rotulo">${escaparHtml(rotulo)}</div>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

function montarTabelaComLinhas({
  colunas = [],
  linhas = [],
  modo = 'manual',
  minLinhasManual = 0,
  vazioTexto = 'Sem registros',
}) {
  const linhasValidas = normalizarLista(linhas);
  let linhasRender = linhasValidas;

  if (modo === 'manual') {
    const faltantes = Math.max(0, minLinhasManual - linhasValidas.length);
    if (faltantes > 0) {
      linhasRender = [
        ...linhasValidas,
        ...Array.from({ length: faltantes }).map(() => ({})),
      ];
    }
  }

  if (!linhasRender.length) {
    return `<div class="sem-registro">${escaparHtml(vazioTexto)}</div>`;
  }

  return `
    <table class="tabela">
      <thead>
        <tr>
          ${colunas.map((col) => `<th>${escaparHtml(col.titulo)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${linhasRender.map((linha) => `
          <tr>
            ${colunas.map((col) => `<td>${col.render(linha, modo)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function montarSubstanciasTabela(substancias, modo = 'manual') {
  const lista = normalizarLista(substancias);

  if (modo === 'completo') {
    const somenteCadastradas = lista.filter((item) => temConteudoLinha(item, ['tipo', 'desde_quando', 'quantidade']));
    return montarTabelaComLinhas({
      modo,
      linhas: somenteCadastradas,
      vazioTexto: 'Nenhuma substância cadastrada.',
      colunas: [
        { titulo: 'Substância', render: (item) => campoValor(item?.tipo, modo) },
        { titulo: 'Desde quando', render: (item) => campoValor(item?.desde_quando, modo) },
        { titulo: 'Quantidade/Frequência', render: (item) => campoValor(item?.quantidade, modo) },
      ],
    });
  }

  const linhasBase = SUBSTANCIAS_PIA.map((tipo) => {
    const encontrado = lista.find((item) => String(item?.tipo || '').toLowerCase() === tipo.toLowerCase());
    return {
      tipo,
      desde_quando: encontrado?.desde_quando || '',
      quantidade: encontrado?.quantidade || '',
    };
  });
  const extras = lista.filter(
    (item) => !SUBSTANCIAS_PIA.some((tipo) => tipo.toLowerCase() === String(item?.tipo || '').toLowerCase()),
  );

  return montarTabelaComLinhas({
    modo,
    linhas: [...linhasBase, ...extras],
    minLinhasManual: SUBSTANCIAS_PIA.length,
    colunas: [
      { titulo: 'Substância', render: (item) => campoValor(item?.tipo, modo) },
      { titulo: 'Desde quando', render: (item) => campoValor(item?.desde_quando, modo) },
      { titulo: 'Quantidade/Frequência', render: (item) => campoValor(item?.quantidade, modo) },
    ],
  });
}

function estilosFormulario() {
  return `
    @page { size: A4 portrait; margin: 12mm 10mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
    .no-print { margin: 14px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; cursor: pointer; }
    .pagina {
      display: flex;
      flex-direction: column;
      min-height: calc(297mm - 26mm);
      break-after: page;
      page-break-after: always;
      padding: 0 2mm;
    }
    .pagina:last-child { break-after: auto; page-break-after: auto; }
    .pagina-corpo { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
    .pagina-rodape {
      flex: 0 0 auto;
      margin-top: auto;
      padding-top: 10mm;
    }
    .cabecalho {
      display: flex;
      justify-content: space-between;
      gap: 22px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .cabecalho-left { width: 34%; }
    .logo { width: 170px; max-height: 58px; object-fit: contain; }
    .identidade-nome { margin-top: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #374151; }
    .cabecalho-right { width: 66%; text-align: right; }
    .cabecalho-right h1 { margin: 0; font-size: 18px; letter-spacing: .03em; }
    .cabecalho-right p { margin: 3px 0; font-size: 11px; color: #4b5563; line-height: 1.35; }
    .meta-pagina { color: #1f2937 !important; font-weight: 700; }
    .secao {
      margin-bottom: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 11px 12px;
    }
    .secao-quebravel {
      break-inside: auto;
      page-break-inside: auto;
    }
    .secao h2 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #0f766e; letter-spacing: .05em; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; }
    .campo {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 9px;
      min-height: 52px;
      background: #fafafa;
    }
    .campo-label {
      display: block;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 5px;
      letter-spacing: .04em;
    }
    .campo-valor { font-size: 11px; color: #111827; white-space: pre-wrap; line-height: 1.45; }
    .campo-valor .linha-preenchimento { width: 100%; }
    .linha-preenchimento { display: inline-block; width: 100%; border-bottom: 1px solid #6b7280; min-height: 18px; }
    .linhas-manuais { display: grid; gap: 9px; }
    .valor-multilinha { min-height: 62px; line-height: 1.45; white-space: pre-wrap; }
    .tabela { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .tabela th, .tabela td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 10px; vertical-align: top; line-height: 1.4; }
    .tabela th { background: #f3f4f6; text-transform: uppercase; letter-spacing: .03em; font-size: 9px; }
    .sem-registro { border: 1px dashed #9ca3af; border-radius: 8px; padding: 12px; font-size: 10px; color: #6b7280; }
    .bloco-assinaturas-pagina {
      margin-top: auto;
      padding-top: 16mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .assinatura-bloco { display: flex; flex-direction: column; min-height: 36mm; }
    .assinatura-espaco { flex: 1 1 auto; min-height: 24mm; }
    .assinatura-traco { border-bottom: 1px solid #111827; width: 100%; }
    .assinatura-rotulo {
      padding-top: 7px;
      text-align: center;
      font-size: 10px;
      color: #374151;
      line-height: 1.35;
    }
    .assinatura-digital-texto {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 24mm;
      padding: 4px 6px;
      text-align: center;
      font-size: 10px;
      line-height: 1.35;
      color: #111827;
      font-weight: 700;
    }
    .assinatura-digital-texto div + div {
      margin-top: 3px;
    }
    .texto-termo { font-size: 10px; line-height: 1.5; white-space: pre-wrap; text-align: justify; margin-bottom: 4mm; }
    .pagina-termo {
      height: calc(297mm - 26mm);
      min-height: calc(297mm - 26mm);
    }
    .pagina-termo .pagina-corpo {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .pagina-termo .cabecalho { margin-bottom: 10px; padding-bottom: 10px; }
    .pagina-termo .cabecalho-right h1 { font-size: 17px; }
    .pagina-termo .cabecalho-right p { margin: 2px 0; font-size: 10px; line-height: 1.3; }
    .pagina-termo .logo { width: 160px; max-height: 54px; }
    .pagina-termo .secao-termo {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      margin-bottom: 0;
      padding: 9px 11px;
      min-height: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pagina-termo .secao-termo h2 { margin-bottom: 8px; font-size: 11px; flex-shrink: 0; }
    .paragrafos-termo-fluxo { flex: 1 1 auto; min-height: 0; }
    .paragrafo-termo {
      margin: 0 0 3px;
      font-size: 10px;
      line-height: 1.32;
      text-align: justify;
    }
    .pagina-lgpd {
      height: calc(297mm - 26mm);
      min-height: calc(297mm - 26mm);
    }
    .pagina-lgpd .pagina-corpo {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .secao-lgpd {
      flex: 0 0 auto;
      margin-bottom: 8mm;
      padding: 0 2mm;
      border: 0;
      background: transparent;
    }
    .titulo-lgpd,
    .subtitulo-lgpd {
      margin: 0;
      text-align: center;
      text-transform: uppercase;
      color: #111827;
      letter-spacing: .03em;
    }
    .titulo-lgpd { font-size: 12px; font-weight: 800; margin-bottom: 4px; }
    .subtitulo-lgpd { font-size: 11px; font-weight: 700; margin-bottom: 10px; }
    .texto-lgpd-corpo {
      margin: 0;
      font-size: 10.5px;
      line-height: 1.34;
      text-align: justify;
      color: #111827;
    }
    .destaque-termo { font-weight: 800; text-decoration: underline; }
    .rodape-lgpd-formulario {
      margin-top: auto;
      flex-shrink: 0;
      padding-top: 4mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .data-lgpd {
      margin: 0 0 8mm;
      font-size: 10.5px;
      line-height: 1.4;
    }
    .linha-data-lgpd {
      display: inline-block;
      border-bottom: 1px solid #111827;
      min-height: 14px;
      vertical-align: bottom;
    }
    .linha-data-lgpd.curta { width: 28px; }
    .linha-data-lgpd.media { width: 120px; }
    .grid-lgpd-assinatura {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }
    .campo-lgpd { margin-bottom: 7mm; }
    .label-lgpd {
      display: block;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #111827;
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .valor-lgpd {
      min-height: 18px;
      border-bottom: 1px solid #111827;
      font-size: 10.5px;
      line-height: 1.35;
      padding-bottom: 2px;
    }
    .linha-assinatura-lgpd {
      min-height: 28mm;
      border-bottom: 1px solid #111827;
    }
    .rodape-lgpd-formulario {
      margin-top: auto;
      padding-top: 9mm;
      flex-shrink: 0;
    }
    .bloco-assinaturas-termo .assinatura-bloco { min-height: 30mm; }
    .bloco-assinaturas-termo .assinatura-espaco { min-height: 20mm; }
    .pagina-termo .pagina-rodape { padding-top: 6mm; }
    .rodape-relatorio {
      border-top: 1px solid #e5e7eb;
      padding-top: 7px;
      color: #6b7280;
      font-size: 9px;
      text-align: center;
      line-height: 1.4;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .direitos-reservados { margin-top: 5px; font-size: 8px; font-weight: 700; }
    .direitos-reservados a { color: #4f46e5; text-decoration: none; }
    @media screen {
      .pagina { margin-bottom: 18px; box-shadow: 0 0 0 1px #e5e7eb; }
    }
    @media print {
      .no-print { display: none; }
      .pagina { min-height: calc(297mm - 26mm); padding: 0; box-shadow: none; }
      .pagina-termo,
      .pagina-lgpd {
        height: calc(297mm - 26mm);
        min-height: calc(297mm - 26mm);
      }
      .pagina-rodape { padding-top: 8mm; }
      .pagina-termo .paragrafo-termo { font-size: 9.5px; line-height: 1.3; }
      .texto-lgpd-corpo { font-size: 10px; line-height: 1.32; }
      .titulo-lgpd { font-size: 11px; }
      .subtitulo-lgpd { font-size: 10px; }
      .linha-assinatura-lgpd { min-height: 24mm; }
      .bloco-assinaturas-termo { padding-top: 8mm; }
      .bloco-assinaturas-termo .assinatura-bloco { min-height: 28mm; }
      .bloco-assinaturas-termo .assinatura-espaco { min-height: 18mm; }
      .pagina-termo .pagina-rodape { padding-top: 5mm; }
      .assinatura-bloco { min-height: 34mm; }
      .assinatura-espaco { min-height: 22mm; }
      .cabecalho, .rodape-relatorio, .bloco-assinaturas-pagina, .rodape-lgpd-formulario { break-inside: avoid; page-break-inside: avoid; }
      .secao:not(.secao-quebravel), .secao-termo, .secao-lgpd { break-inside: avoid; page-break-inside: avoid; }
    }
  `;
}

export function montarHtmlFormularioPia({
  convivente,
  piaPrincipal,
  origensEncaminhamento = [],
  listaTecnicos = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  modo = 'manual',
  assinaturaDigital = null,
}) {
  const modoValido = modo === 'completo' ? 'completo' : 'manual';
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const dataInicialPia = dataBr(convivente?.data_inicio_pia || convivente?.data_entrada);
  const origemPrincipal = obterLabelOrigem(convivente?.origem_encaminhamento_id, origensEncaminhamento)
    || valorTexto(convivente?.origem_encaminhamento_outros);
  const tecnicoNome = obterNomeTecnico(convivente?.tecnico_id, listaTecnicos);
  const familiares = normalizarLista(convivente?.familiares);
  const documentosCivis = normalizarLista(convivente?.documentos_civis);
  const substancias = normalizarLista(convivente?.substancias);
  const medicamentos = normalizarLista(convivente?.medicamentos);
  const internacoes = normalizarLista(convivente?.internacoes);
  const equipamentosAnteriores = normalizarLista(convivente?.equipamentos_anteriores);
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || 'Convivente';

  const familiaresFiltrados = modoValido === 'completo'
    ? familiares.filter((item) => temConteudoLinha(item, ['parentesco', 'nome', 'idade', 'telefone', 'cep', 'logradouro', 'endereco']))
    : familiares;
  const documentosFiltrados = modoValido === 'completo'
    ? documentosCivis.filter((item) => temConteudoLinha(item, ['tipo', 'tipo_outros', 'numero', 'orientacoes']))
    : documentosCivis;
  const medicamentosFiltrados = modoValido === 'completo'
    ? medicamentos.filter((item) => temConteudoLinha(item, ['nome', 'tempo_uso', 'modo_uso']))
    : medicamentos;
  const internacoesFiltradas = modoValido === 'completo'
    ? internacoes.filter((item) => temConteudoLinha(item, ['onde', 'periodo', 'quem_encaminhou']))
    : internacoes;
  const equipamentosFiltrados = modoValido === 'completo'
    ? equipamentosAnteriores.filter((item) => temConteudoLinha(item, ['origem_encaminhamento_id', 'descricao_outros']))
    : equipamentosAnteriores;

  const rodapeHtml = montarRodapePagina(identidadeRelatorio);
  const totalPaginas = 8;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PIA Oficial - ${escaparHtml(nomeConvivente)}</title>
        <style>
          ${estilosFormulario()}
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()">Imprimir formulário PIA</button>

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '1',
            totalPaginas,
            tituloPagina: 'Identificação e dados iniciais',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao">
            <h2>1. Identificação do convivente</h2>
            <div class="grid-3">
              <div class="campo"><span class="campo-label">Nome civil</span><div class="campo-valor">${campoValor(convivente?.nome_completo, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Nome social</span><div class="campo-valor">${campoValor(convivente?.nome_social, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Data de nascimento</span><div class="campo-valor">${campoValor(dataBr(convivente?.data_nascimento), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">CPF</span><div class="campo-valor">${campoValor(convivente?.cpf, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">RG</span><div class="campo-valor">${campoValor(convivente?.rg, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Estado civil</span><div class="campo-valor">${campoValor(convivente?.estado_civil, modoValido)}</div></div>
            </div>
          </div>

          <div class="secao">
            <h2>2. Dados institucionais e encaminhamento</h2>
            <div class="grid-2">
              <div class="campo"><span class="campo-label">Data de entrada/vinculação</span><div class="campo-valor">${campoValor(dataBr(convivente?.data_entrada), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Data inicial PIA</span><div class="campo-valor">${campoValor(dataInicialPia, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Origem / Encaminhado por</span><div class="campo-valor">${campoValor(origemPrincipal, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Técnico de referência</span><div class="campo-valor">${campoValor(tecnicoNome, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Status no acolhimento</span><div class="campo-valor">${campoValor(convivente?.status, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Nº SISA / Nº NIS</span><div class="campo-valor">${campoValor([convivente?.numero_sisa, convivente?.numero_nis].filter(Boolean).join(' / '), modoValido)}</div></div>
            </div>
          </div>
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '2',
            totalPaginas,
            tituloPagina: 'Família e documentação',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao">
            <h2>3. Situação familiar afetivo-social</h2>
            <div class="grid-2">
              <div class="campo">
                <span class="campo-label">Situação familiar</span>
                <div class="campo-valor">${campoValor(relacaoFamiliarLabel(convivente?.relacao_familiar_situacao, convivente?.relacao_familiar_outra), modoValido)}</div>
              </div>
              <div class="campo">
                <span class="campo-label">Nome da mãe / Nome do pai</span>
                <div class="campo-valor">${campoValor([convivente?.nome_mae, convivente?.nome_pai].filter(Boolean).join(' | '), modoValido)}</div>
              </div>
            </div>
            ${montarTabelaComLinhas({
              modo: modoValido,
              linhas: familiaresFiltrados,
              minLinhasManual: 5,
              vazioTexto: 'Nenhum familiar/referência cadastrado.',
              colunas: [
                { titulo: 'Parentesco', render: (item, m) => campoValor(item?.parentesco === 'Outros' ? item?.parentesco_outros || 'Outros' : item?.parentesco, m) },
                { titulo: 'Nome', render: (item, m) => campoValor(item?.nome, m) },
                { titulo: 'Idade', render: (item, m) => campoValor(item?.idade, m) },
                { titulo: 'Telefone', render: (item, m) => campoValor(item?.telefone, m) },
                { titulo: 'Endereço', render: (item, m) => campoValor(montarEnderecoFamiliarResumo(item), m) },
              ],
            })}
          </div>

          <div class="secao">
            <h2>4. Documentos civis</h2>
            ${montarTabelaComLinhas({
              modo: modoValido,
              linhas: documentosFiltrados,
              minLinhasManual: 8,
              vazioTexto: 'Nenhum documento civil cadastrado.',
              colunas: [
                { titulo: 'Tipo', render: (item, m) => campoValor(item?.tipo === 'Outros' ? item?.tipo_outros || 'Outros' : item?.tipo, m) },
                { titulo: 'Número', render: (item, m) => campoValor(item?.numero, m) },
                { titulo: 'Observações', render: (item, m) => campoValor(item?.orientacoes, m) },
              ],
            })}
          </div>
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '3',
            totalPaginas,
            tituloPagina: 'Saúde e histórico clínico',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao">
            <h2>5. Saúde e dados sensíveis do PIA</h2>
            <div class="grid-2">
              <div class="campo"><span class="campo-label">Acompanhamento CAPS</span><div class="campo-valor">${campoValor(convivente?.acompanhamento_caps, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Egresso prisional</span><div class="campo-valor">${campoValor(boolSimNao(convivente?.egresso_prisional), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Pendência judiciária</span><div class="campo-valor">${campoValor(boolSimNao(convivente?.pendencia_judiciaria), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Detalhe da pendência judiciária</span><div class="campo-valor">${campoValor(convivente?.pendencia_judiciaria_qual, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Pendência eleitoral</span><div class="campo-valor">${campoValor(boolSimNao(convivente?.pendencia_eleitoral), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Detalhe da pendência eleitoral</span><div class="campo-valor">${campoValor(convivente?.pendencia_eleitoral_qual, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Motivo/Artigo (egresso)</span><div class="campo-valor">${campoValor(convivente?.egresso_artigo_motivo, modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Ano (egresso)</span><div class="campo-valor">${campoValor(convivente?.egresso_ano, modoValido)}</div></div>
            </div>
          </div>

          <div class="secao">
            <h2>6. Uso de substâncias psicoativas</h2>
            ${montarSubstanciasTabela(substancias, modoValido)}
          </div>
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '4',
            totalPaginas,
            tituloPagina: 'Medicamentos e internações',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao secao-quebravel">
            <h2>7. Medicamentos e internações</h2>
            ${montarTabelaComLinhas({
              modo: modoValido,
              linhas: medicamentosFiltrados,
              minLinhasManual: 4,
              vazioTexto: 'Nenhum medicamento cadastrado.',
              colunas: [
                { titulo: 'Medicamento', render: (item, m) => campoValor(item?.nome, m) },
                { titulo: 'Tempo de uso', render: (item, m) => campoValor(item?.tempo_uso, m) },
                { titulo: 'Modo de uso', render: (item, m) => campoValor(item?.modo_uso, m) },
              ],
            })}
            <div style="height:12px"></div>
            ${montarTabelaComLinhas({
              modo: modoValido,
              linhas: internacoesFiltradas,
              minLinhasManual: 3,
              vazioTexto: 'Nenhuma internação cadastrada.',
              colunas: [
                { titulo: 'Onde', render: (item, m) => campoValor(item?.onde, m) },
                { titulo: 'Período', render: (item, m) => campoValor(item?.periodo, m) },
                { titulo: 'Quem encaminhou', render: (item, m) => campoValor(item?.quem_encaminhou, m) },
              ],
            })}
          </div>
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '5',
            totalPaginas,
            tituloPagina: 'Planejamento e perspectivas (seção 8)',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao">
            <h2>8. Planejamento e perspectivas (PIA principal estruturado)</h2>
            <div class="grid-2">
              <div class="campo">
                <span class="campo-label">Expectativas em relação ao serviço</span>
                <div class="campo-valor">${campoMultilinha(piaPrincipal?.expectativas_servico, modoValido, 3)}</div>
              </div>
              <div class="campo">
                <span class="campo-label">Expectativas de vida e projetos pessoais</span>
                <div class="campo-valor">${campoMultilinha(piaPrincipal?.expectativas_vida_projetos, modoValido, 3)}</div>
              </div>
              <div class="campo"><span class="campo-label">Destinação SIAT III</span><div class="campo-valor">${campoValor(boolSimNao(piaPrincipal?.destino_siat_iii), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Moradia autônoma</span><div class="campo-valor">${campoValor(boolSimNao(piaPrincipal?.destino_moradia_autonoma), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Retorno familiar</span><div class="campo-valor">${campoValor(boolSimNao(piaPrincipal?.destino_retorno_familiar), modoValido)}</div></div>
              <div class="campo"><span class="campo-label">Explicação da destinação</span><div class="campo-valor">${campoMultilinha(piaPrincipal?.destino_explicacao, modoValido, 2)}</div></div>
            </div>
            <div class="campo" style="margin-top:7px;">
              <span class="campo-label">Principais dificuldades para execução dos planos</span>
              <div class="campo-valor">${campoMultilinha(piaPrincipal?.dificuldades_planos, modoValido, 3)}</div>
            </div>
          </div>
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '6',
            totalPaginas,
            tituloPagina: 'Equipamentos anteriores e ciência',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}

          <div class="secao">
            <h2>9. Equipamentos anteriores frequentados</h2>
            ${montarTabelaComLinhas({
              modo: modoValido,
              linhas: equipamentosFiltrados,
              minLinhasManual: 5,
              vazioTexto: 'Nenhum equipamento anterior cadastrado.',
              colunas: [
                {
                  titulo: 'Origem / Equipamento',
                  render: (item, m) => campoValor(
                    obterLabelOrigem(item?.origem_encaminhamento_id, origensEncaminhamento)
                      || valorTexto(item?.descricao_outros),
                    m,
                  ),
                },
                {
                  titulo: 'Descrição complementar',
                  render: (item, m) => campoValor(
                    item?.origem_encaminhamento_id ? valorTexto(item?.descricao_outros) : '',
                    m,
                  ),
                },
              ],
            })}
          </div>

          <div class="secao">
            <h2>10. Ciência do convivente e responsável técnico</h2>
            <div class="campo">
              <span class="campo-label">Observações complementares</span>
              <div class="campo-valor">${campoMultilinha('', 'manual', 3)}</div>
            </div>
          </div>

          ${montarBlocoAssinaturas([
            'Assinatura do convivente',
            'Assinatura e carimbo do técnico responsável',
          ], { assinaturaDigital })}
        `, rodapeHtml)}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '7',
            totalPaginas,
            tituloPagina: 'Termo de compromisso',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}
          <div class="secao secao-termo">
            <h2>Termo de compromisso e responsabilidade</h2>
            ${formatarTextoTermoCompromissoHtml(TERMO_COMPROMISSO_TEXTO)}
          </div>
          ${montarBlocoAssinaturas([
            'Assinatura do convivente',
            'Assinatura do responsável pelo atendimento',
          ], { termo: true, assinaturaDigital })}
        `, rodapeHtml, { classeExtra: 'pagina-termo' })}

        ${montarPaginaPia(`
          ${montarCabecalhoPagina({
            convivente,
            logoSrc,
            nomeExibicao,
            numeroPagina: '8',
            totalPaginas,
            tituloPagina: 'Termo LGPD',
            dataInicialPia,
            nomeTecnico: tecnicoNome,
            modo: modoValido,
          })}
          ${montarConteudoPaginaLgpd(convivente, modoValido, assinaturaDigital)}
        `, rodapeHtml, { classeExtra: 'pagina-lgpd' })}
      </body>
    </html>
  `;
}
