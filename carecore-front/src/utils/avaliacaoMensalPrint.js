import { imprimirRelatorio } from './imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarDataFiltro(iso) {
  const texto = String(iso || '');
  const partes = texto.split('-');
  if (partes.length !== 3) return texto;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function identidadeDaImpressao(identidadeRelatorio, logoRelatorioDataUrl) {
  return {
    ...(identidadeRelatorio || {}),
    logo_src: logoRelatorioDataUrl || undefined,
  };
}

function blocoDataAssinatura(nome) {
  return `
    <div class="fecho">
      <p class="data-linha">
        São Paulo,
        <span class="traco curto"></span> de
        <span class="traco medio"></span> de
        <span class="traco curto"></span>.
      </p>
      <div class="assinatura">
        <div class="espaco"></div>
        <div class="risco"></div>
        <div class="rotulo">Assinatura do convivente</div>
        <div class="nome">${escaparHtml(nome)}</div>
      </div>
    </div>
  `;
}

const ESTILO_FICHA = `
  <style>
    .ficha { margin: 0; }
    .ficha h2 { margin: 0 0 4px; font-size: 16px; }
    .meta { margin: 0 0 10px; color: #4b5563; font-size: 12px; }
    .perguntas { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .perguntas th, .perguntas td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 11px; }
    .perguntas th { background: #f3f4f6; }
    .sugestao { margin-top: 10px; font-size: 12px; }
    .fecho { margin-top: 28px; break-inside: avoid; page-break-inside: avoid; }
    .data-linha { margin: 0 0 16px; font-size: 12px; }
    .traco { display: inline-block; border-bottom: 1px solid #111827; min-height: 14px; vertical-align: bottom; }
    .traco.curto { width: 36px; }
    .traco.medio { width: 120px; }
    .assinatura { width: 280px; margin-left: auto; }
    .espaco { min-height: 22mm; }
    .risco { border-top: 1px solid #111827; }
    .rotulo { margin-top: 6px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .nome { margin-top: 2px; text-align: center; font-size: 11px; }
    .opcoes { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 6px; }
    .opcao { font-size: 11px; white-space: nowrap; }
    .caixa { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #111827; margin-right: 5px; vertical-align: -1px; }
    .linha-escrever { border-bottom: 1px solid #111827; height: 22px; margin-top: 8px; }
    .bloco-titulo { margin: 16px 0 6px; font-size: 13px; }
    .totais, .lista { width: 100%; border-collapse: collapse; }
    .totais th, .totais td, .lista th, .lista td { border: 1px solid #d1d5db; padding: 5px 6px; font-size: 10px; text-align: left; vertical-align: top; }
    .totais th, .lista th { background: #f3f4f6; }
    .totais td.num, .totais th.num { text-align: center; }
  </style>
`;

function fichaPessoa(pessoa) {
  const linhas = (pessoa.respostas || []).map((item, ordem) => `
    <tr>
      <td>${ordem + 1}. ${escaparHtml(item.pergunta)}</td>
      <td>${escaparHtml(item.resposta)}</td>
    </tr>
  `).join('');
  const sugestoes = (pessoa.sugestoes || '').trim();
  return `
    <article class="ficha">
      <h2>${escaparHtml(pessoa.nome)}</h2>
      <p class="meta">
        Prontuário ${escaparHtml(pessoa.numero_prontuario)}
        · Técnico: ${escaparHtml(pessoa.tecnico || 'Sem técnico')}
        · Respondido em ${escaparHtml(pessoa.respondido_em)}
      </p>
      <table class="perguntas">
        <thead>
          <tr><th>Pergunta</th><th>Resposta</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p class="sugestao"><b>Sugestões e elogios:</b> ${escaparHtml(sugestoes || '—')}</p>
      ${blocoDataAssinatura(pessoa.nome)}
    </article>
  `;
}

const ESTILO_FICHA_UMA_FOLHA = `
  <style>
    .logo-relatorio { width: 148px; max-height: 40px; }
    .cabecalho-relatorio { gap: 16px; margin-bottom: 6px; padding-bottom: 6px; }
    h1 { font-size: 16px; }
    .subtitulo, .gerado, .identidade-nome { font-size: 11px; }
    .identidade-nome { margin-top: 2px; }
    .ficha-uma-folha {
      min-height: 244mm;
      display: flex;
      flex-direction: column;
    }
    .ficha-uma-folha h2 { margin: 0; font-size: 13px; }
    .ficha-uma-folha .meta { margin: 1px 0 5px; font-size: 11px; }
    .ficha-uma-folha .lista-perguntas {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      border-top: 1px solid #d1d5db;
    }
    .ficha-uma-folha .linha-pergunta {
      flex: 1 1 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px 12px;
      min-height: 0;
      padding: 1px 8px;
      border-bottom: 1px solid #d1d5db;
      font-size: 11px;
      line-height: 1.25;
    }
    .ficha-uma-folha .enunciado { flex: 1 1 auto; }
    .ficha-uma-folha .opcoes {
      flex: 0 0 auto;
      display: flex;
      flex-wrap: nowrap;
      gap: 2px 10px;
      margin-top: 0;
    }
    .ficha-uma-folha .opcao { font-size: 10.5px; white-space: nowrap; }
    .ficha-uma-folha .caixa { width: 12px; height: 12px; margin-right: 4px; }
    .ficha-uma-folha .rodape-ficha { flex: 0 0 auto; }
    .ficha-uma-folha .sugestao { margin: 7px 0 0; font-size: 11px; }
    .ficha-uma-folha .linha-escrever { height: 18px; margin-top: 2px; }
    .ficha-uma-folha .fecho { margin-top: 8px; }
    .ficha-uma-folha .data-linha { margin: 0 0 4px; font-size: 11px; }
    .ficha-uma-folha .espaco { min-height: 16mm; }
    .ficha-uma-folha .rotulo { margin-top: 4px; font-size: 10px; }
    .ficha-uma-folha .nome { font-size: 11px; }
    .rodape-relatorio { padding-top: 4px; font-size: 9px; }
    .espaco-rodape { height: 4px; }
  </style>
`;

function fichaEmBranco(pessoa, perguntas, mes) {
  const linhas = (perguntas || []).map((pergunta, ordem) => `
    <div class="linha-pergunta">
      <span class="enunciado">${ordem + 1}. ${escaparHtml(pergunta.texto)}</span>
      <span class="opcoes">
        ${(pergunta.opcoes || []).map((opcao) => `
          <span class="opcao"><span class="caixa"></span>${escaparHtml(opcao.rotulo)}</span>
        `).join('')}
      </span>
    </div>
  `).join('');
  return `
    <article class="ficha ficha-uma-folha">
      <h2>${escaparHtml(pessoa.nome)}</h2>
      <p class="meta">
        Prontuário ${escaparHtml(pessoa.numero_prontuario)}
        · Técnico: ${escaparHtml(pessoa.tecnico || 'Sem técnico')}
        ${mes ? ` · Mês: ${escaparHtml(mes)}` : ''}
        · Marque uma opção em cada pergunta.
      </p>
      <div class="lista-perguntas">${linhas}</div>
      <div class="rodape-ficha">
        <p class="sugestao"><b>Sugestões e elogios</b></p>
        <div class="linha-escrever"></div>
        <div class="linha-escrever"></div>
        ${blocoDataAssinatura(pessoa.nome)}
      </div>
    </article>
  `;
}

export async function imprimirAvaliacaoEmBranco({
  pessoa,
  perguntas = [],
  mes = '',
  identidadeRelatorio = null,
  subtitulo = '',
}) {
  if (!pessoa || !perguntas.length) return;
  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  imprimirRelatorio({
    titulo: 'Avaliação mensal para preencher',
    subtitulo,
    identidade: identidadeDaImpressao(identidadeRelatorio, logoRelatorioDataUrl),
    orientacao: 'portrait',
    margemPagina: '6mm 7mm 6mm',
    conteudoExtraHtml: `${ESTILO_FICHA}${ESTILO_FICHA_UMA_FOLHA}${fichaEmBranco(pessoa, perguntas, mes)}`,
    colunas: [],
    dados: [],
  });
}

export async function imprimirAvaliacaoParaAssinatura({
  pessoas = [],
  relatorio,
  identidadeRelatorio = null,
  subtitulo = '',
}) {
  if (!pessoas.length) return;
  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  imprimirRelatorio({
    titulo: 'Avaliação mensal para assinatura',
    subtitulo,
    identidade: identidadeDaImpressao(identidadeRelatorio, logoRelatorioDataUrl),
    orientacao: 'portrait',
    paginasHtml: pessoas.map((pessoa) => `${ESTILO_FICHA}${fichaPessoa(pessoa)}`),
    colunas: [],
    dados: [],
  });
  return relatorio;
}

export function recorteDoRelatorio(relatorio, filtro = {}) {
  if (!relatorio) return null;
  const respostaId = filtro.respostaId || '';
  const rotulo = filtro.rotuloResposta || '';
  const perguntaId = filtro.perguntaId || '';
  const base = {
    ...relatorio,
    data_inicio: relatorio.data_inicio || filtro.dataInicio || '',
    data_fim: relatorio.data_fim || filtro.dataFim || '',
  };
  if (!respostaId && !rotulo && !perguntaId) return base;

  const pessoas = (relatorio.pessoas || []).map((pessoa) => {
    const marcadas = (pessoa.respostas || []).filter((item) => {
      if (perguntaId && item.id && item.id !== perguntaId) return false;
      if ((respostaId || rotulo) && item.resposta_id && respostaId) {
        return item.resposta_id === respostaId;
      }
      if (rotulo) return item.resposta === rotulo;
      return Boolean(perguntaId);
    });
    return marcadas.length ? { ...pessoa, marcadas } : null;
  }).filter(Boolean);

  const perguntas = (relatorio.perguntas || []).map((pergunta) => {
    const opcoes = (pergunta.opcoes || [])
      .filter((opcao) => !respostaId || opcao.id === respostaId || opcao.rotulo === rotulo)
      .map((opcao) => {
        const total = pessoas.filter((pessoa) => pessoa.marcadas.some((item) => {
          const mesmaPergunta = (item.id && item.id === pergunta.id) || item.pergunta === pergunta.texto;
          if (!mesmaPergunta) return false;
          if (respostaId || rotulo) return true;
          return item.resposta_id === opcao.id || item.resposta === opcao.rotulo;
        })).length;
        return { ...opcao, total };
      });
    return { ...pergunta, opcoes };
  }).filter((pergunta) => pergunta.opcoes.some((opcao) => opcao.total > 0));

  return {
    ...base,
    pessoas,
    perguntas,
    total: pessoas.length,
    somenteResposta: rotulo,
  };
}

function tabelaTotais(perguntas, somenteRotulo = '') {
  const colunas = somenteRotulo
    ? [somenteRotulo]
    : ['Ótimo', 'Bom', 'Mais ou menos', 'Preciso melhorar', 'Ruim'];
  const cabecalho = colunas.map((rotulo) => `<th class="num">${escaparHtml(rotulo)}</th>`).join('');
  const linhas = (perguntas || []).map((pergunta, ordem) => {
    const porRotulo = Object.fromEntries(
      (pergunta.opcoes || []).map((opcao) => [opcao.rotulo, opcao.total]),
    );
    const celulas = colunas.map((rotulo) => {
      if (!Object.prototype.hasOwnProperty.call(porRotulo, rotulo)) {
        return '<td class="num">—</td>';
      }
      return `<td class="num">${escaparHtml(porRotulo[rotulo])}</td>`;
    }).join('');
    return `<tr><td>${ordem + 1}. ${escaparHtml(pergunta.texto)}</td>${celulas}</tr>`;
  }).join('');
  return `
    <h2 class="bloco-titulo">Totais por pergunta</h2>
    <table class="totais">
      <thead><tr><th>Pergunta</th>${cabecalho}</tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

function tabelaPessoas(pessoas) {
  const comFiltro = pessoas.some((pessoa) => pessoa.marcadas?.length);
  const linhas = pessoas.map((pessoa) => {
    const onde = (pessoa.marcadas || []).map((item) => item.pergunta).join('; ');
    return `
    <tr>
      <td>${escaparHtml(pessoa.numero_prontuario)}</td>
      <td>${escaparHtml(pessoa.nome)}</td>
      <td>${escaparHtml(pessoa.tecnico)}</td>
      <td>${escaparHtml(pessoa.status)}</td>
      <td>${escaparHtml(pessoa.respondido_em)}</td>
      <td>${escaparHtml(comFiltro ? (onde || '—') : (pessoa.sugestoes || '—'))}</td>
    </tr>
  `;
  }).join('');
  return `
    <h2 class="bloco-titulo">Quem respondeu</h2>
    <table class="lista">
      <thead>
        <tr>
          <th>Prontuário</th><th>Nome</th><th>Técnico</th><th>Situação</th><th>Respondido em</th><th>${comFiltro ? 'Onde marcou' : 'Sugestões'}</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export async function imprimirRelatorioAvaliacaoEquipe({
  relatorio,
  identidadeRelatorio = null,
  subtitulo = '',
}) {
  if (!relatorio?.pessoas?.length) return;
  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  imprimirRelatorio({
    titulo: 'Avaliação mensal',
    subtitulo,
    metricas: [{ label: 'Respostas', valor: relatorio.total ?? relatorio.pessoas.length }],
    identidade: identidadeDaImpressao(identidadeRelatorio, logoRelatorioDataUrl),
    orientacao: 'landscape',
    conteudoExtraHtml: `${ESTILO_FICHA}${tabelaTotais(relatorio.perguntas, relatorio.somenteResposta || '')}${tabelaPessoas(relatorio.pessoas)}`,
    colunas: [],
    dados: [],
  });
}

export function colunasExportacaoAvaliacao(relatorio) {
  const perguntas = (relatorio?.perguntas || []).map((pergunta, ordem) => (
    `${String(ordem + 1).padStart(2, '0')}. ${pergunta.texto}`
  ));
  return ['Prontuário', 'Nome', 'Técnico', 'Situação', 'Respondido em', ...perguntas, 'Sugestões e elogios'];
}

export function dadosExportacaoAvaliacao(relatorio) {
  const perguntas = relatorio?.perguntas || [];
  return (relatorio?.pessoas || []).map((pessoa) => {
    const porId = Object.fromEntries(
      (pessoa.respostas || []).map((item) => [item.id, item.resposta]),
    );
    const porTexto = Object.fromEntries(
      (pessoa.respostas || []).map((item) => [item.pergunta, item.resposta]),
    );
    const linha = {
      Prontuário: pessoa.numero_prontuario,
      Nome: pessoa.nome,
      Técnico: pessoa.tecnico,
      Situação: pessoa.status,
      'Respondido em': pessoa.respondido_em,
      'Sugestões e elogios': pessoa.sugestoes || '',
    };
    perguntas.forEach((pergunta, ordem) => {
      const coluna = `${String(ordem + 1).padStart(2, '0')}. ${pergunta.texto}`;
      linha[coluna] = porId[pergunta.id] || porTexto[pergunta.texto] || '';
    });
    return linha;
  });
}

export function rotuloPeriodoAvaliacao(relatorio) {
  return `${formatarDataFiltro(relatorio?.data_inicio)} a ${formatarDataFiltro(relatorio?.data_fim)}`;
}
