import {
  BENEFICIOS_PIA_OPCOES,
  EQUIPAMENTO_ANTERIOR_OUTROS,
  RELACAO_FAMILIAR_SITUACOES,
} from '../config/piaFichaConfig';
import {
  calcularIdade,
} from './conviventesUtils';
import {
  formatarDadosConviventeParaTela,
  montarEnderecoFamiliarResumo,
} from './conviventesProntuarioUtils';
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

function temTexto(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'boolean') return true;
  if (typeof valor === 'number') return !Number.isNaN(valor);
  return String(valor).trim() !== '';
}

function texto(valor) {
  if (!temTexto(valor)) return '';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor).trim();
}

function dataBr(valor) {
  if (!valor) return '';
  const parte = String(valor).split('T')[0];
  const [ano, mes, dia] = parte.split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

function obterLocalizacaoLeitoTexto(leitoId, quartos = []) {
  if (!leitoId) return 'Apenas atendimento diurno / sem leito';
  for (const quarto of quartos) {
    const leitoEncontrado = quarto.leitos?.find((leito) => leito.id === leitoId);
    if (leitoEncontrado) return `${quarto.nome} - ${leitoEncontrado.identificacao}`;
  }
  return 'Leito não localizado';
}

function obterLabelOrigem(origemId, origensEncaminhamento = [], textoOutros = '') {
  if (origemId === EQUIPAMENTO_ANTERIOR_OUTROS || !origemId) {
    return textoOutros?.trim() || '';
  }
  const origem = (origensEncaminhamento || []).find((item) => item?.id === origemId);
  return origem?.descricao || textoOutros?.trim() || '';
}

function labelRelacaoFamiliar(valor) {
  const item = RELACAO_FAMILIAR_SITUACOES.find((s) => s.value === valor);
  return item?.label || valor || '';
}

function linha(rotulo, valor) {
  const conteudo = texto(valor);
  if (!conteudo) return '';
  return `
    <tr>
      <th>${escaparHtml(rotulo)}</th>
      <td>${escaparHtml(conteudo)}</td>
    </tr>
  `;
}

function secao(titulo, linhasHtml, { forcar = false } = {}) {
  const linhas = (linhasHtml || '').trim();
  if (!linhas && !forcar) return '';
  return `
    <section class="secao-ficha">
      <h2>${escaparHtml(titulo)}</h2>
      <table>${linhas || '<tr><td class="vazio">Nenhum dado registrado nesta seção.</td></tr>'}</table>
    </section>
  `;
}

function tabelaLista(cabecalhos, linhas) {
  if (!linhas.length) return '';
  return `
    <table class="tabela-lista">
      <thead><tr>${cabecalhos.map((h) => `<th>${escaparHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${linhas.map((cols) => `<tr>${cols.map((c) => `<td>${escaparHtml(c || '-')}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function montarEscolaridadeTexto(c) {
  const partes = [];
  if (c.alfabetizado !== null && c.alfabetizado !== undefined) {
    partes.push(`Alfabetizado: ${c.alfabetizado ? 'Sim' : 'Não'}`);
  }
  if (c.interesse_eja !== null && c.interesse_eja !== undefined) {
    partes.push(`Interesse em EJA: ${c.interesse_eja ? 'Sim' : 'Não'}`);
  }
  if (c.estuda_atualmente !== null && c.estuda_atualmente !== undefined) {
    partes.push(`Estuda atualmente: ${c.estuda_atualmente ? 'Sim' : 'Não'}`);
  }
  if (c.estuda_curso) partes.push(`Curso atual: ${c.estuda_curso}`);
  if (c.ef_concluido) partes.push('Ensino Fundamental: concluído');
  if (c.ef_incompleto) {
    partes.push(`Ensino Fundamental: incompleto${c.ef_incompleto_serie ? ` (${c.ef_incompleto_serie})` : ''}`);
  }
  if (c.em_concluido) partes.push('Ensino Médio: concluído');
  if (c.em_incompleto) {
    partes.push(`Ensino Médio: incompleto${c.em_incompleto_serie ? ` (${c.em_incompleto_serie})` : ''}`);
  }
  if (c.es_concluido) partes.push('Ensino Superior: concluído');
  if (c.es_incompleto) {
    partes.push(`Ensino Superior: incompleto${c.es_incompleto_periodo ? ` (${c.es_incompleto_periodo})` : ''}`);
  }
  if (c.escolaridade) partes.push(`Escolaridade (legado): ${c.escolaridade}`);
  return partes.join(' · ');
}

function montarBeneficiosTexto(beneficios = {}) {
  return BENEFICIOS_PIA_OPCOES
    .filter((opt) => beneficios?.[opt.key]?.ativo)
    .map((opt) => {
      const item = beneficios[opt.key];
      let rotulo = opt.label;
      if (opt.temValor && item?.valor) {
        rotulo += ` — R$ ${Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }
      if (opt.temTexto && item?.texto) rotulo += ` — ${item.texto}`;
      return rotulo;
    })
    .join('; ');
}

function renderIdentificacao(c, { listaTecnicos, quartos, origensEncaminhamento }) {
  const tecnico = listaTecnicos.find((tec) => tec.id === c.tecnico_id);
  const origem = obterLabelOrigem(
    c.origem_encaminhamento_id,
    origensEncaminhamento,
    c.origem_encaminhamento_outros,
  );
  const nascimento = c.data_nascimento
    ? `${dataBr(c.data_nascimento)} (${calcularIdade(c.data_nascimento)} anos)`
    : '';

  return secao('Identificação e situação no serviço', [
    linha('Nome civil', c.nome_completo),
    linha('Nome social', c.nome_social),
    linha('Prontuário institucional', c.numero_institucional),
    linha('CPF', c.cpf),
    linha('RG', c.rg),
    linha('Data de nascimento', nascimento),
    linha('Raça/cor', c.cor_raca),
    linha('Possui religião', c.possui_religiao),
    linha('Religião', c.religiao_qual),
    linha('Identidade de gênero', c.identidade_genero),
    linha('Orientação sexual', c.orientacao_sexual),
    linha('Naturalidade', c.naturalidade),
    linha('Estado civil', c.estado_civil),
    linha('Status no serviço', c.status),
    linha('Data de entrada/vinculação', dataBr(c.data_entrada)),
    linha('Início do PIA', dataBr(c.data_inicio_pia)),
    linha('Origem / encaminhado por', origem),
    linha('Acomodação', obterLocalizacaoLeitoTexto(c.leito_id, quartos)),
    linha('Técnico de referência', tecnico?.nome || ''),
  ].join(''));
}

function renderContato(c) {
  const endereco = [
    c.logradouro,
    c.numero,
    c.complemento,
  ].filter(Boolean).join(', ');
  const localidade = [c.bairro, c.cidade, c.uf].filter(Boolean).join(' — ');

  return secao('Contato e endereço', [
    linha('Telefone / celular', c.telefone_celular),
    linha('Contato de emergência', c.contato_emergencia_nome),
    linha('Telefone de emergência', c.contato_emergencia_telefone),
    linha('Endereço', endereco),
    linha('Bairro / cidade / UF', localidade),
    linha('CEP', c.cep),
  ].join(''));
}

function renderFamilia(c) {
  const familiares = (c.familiares || []).filter(
    (f) => f?.nome || f?.parentesco || f?.telefone || f?.endereco || f?.logradouro,
  );
  const tabelaFamiliares = familiares.length
    ? tabelaLista(
      ['Parentesco', 'Nome', 'Idade', 'Telefone', 'Endereço'],
      familiares.map((f) => [
        f.parentesco,
        f.nome,
        f.idade != null && f.idade !== '' ? String(f.idade) : '',
        f.telefone,
        montarEnderecoFamiliarResumo(f) || f.endereco,
      ]),
    )
    : '';

  const linhas = [
    linha('Nome da mãe', c.nome_mae),
    linha('Nome do pai', c.nome_pai),
    linha('Situação da família natural', labelRelacaoFamiliar(c.relacao_familiar_situacao)),
    linha('Detalhamento da situação familiar', c.relacao_familiar_outra),
  ].join('');

  if (!linhas && !tabelaFamiliares) return '';
  return `
    <section class="secao-ficha">
      <h2>Família e rede de apoio</h2>
      ${linhas ? `<table>${linhas}</table>` : ''}
      ${tabelaFamiliares ? `<div class="subsecao"><h3>Referências familiares cadastradas</h3>${tabelaFamiliares}</div>` : ''}
    </section>
  `;
}

function renderDocumentosCivis(c) {
  const docs = (c.documentos_civis || []).filter((d) => d?.tipo || d?.numero || d?.orientacoes);
  if (!docs.length) return '';

  const tabela = tabelaLista(
    ['Documento', 'Número', 'Orientações / encaminhamento'],
    docs.map((d) => [d.tipo, d.numero, d.orientacoes]),
  );

  return `
    <section class="secao-ficha">
      <h2>Documentação civil</h2>
      ${tabela}
    </section>
  `;
}

function renderEscolaridadeTrabalho(c) {
  const escolaridade = montarEscolaridadeTexto(c);
  const situacoes = (c.situacoes_trabalho || []).join('; ');

  return secao('Escolaridade e trabalho', [
    linha('Escolaridade', escolaridade),
    linha('Profissão', c.profissao),
    linha('Situações de trabalho', situacoes),
    linha('Atividade não remunerada', c.trabalho_nao_remunerada_qual),
    linha('Já participou de curso', c.trabalho_cursos_participou),
    linha('Quais cursos', c.trabalho_cursos_quais),
    linha('Possui certificados', c.trabalho_certificados),
    linha('Quais certificados', c.trabalho_certificados_quais),
    linha('Pretende fazer curso', c.trabalho_pretende_curso),
    linha('Cursos pretendidos', c.trabalho_pretende_curso_quais),
  ].join(''));
}

function renderBeneficios(c) {
  const beneficios = montarBeneficiosTexto(c.beneficios_pia);
  const renda = c.renda_mensal != null && c.renda_mensal !== ''
    ? `R$ ${Number(c.renda_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '';

  return secao('Benefícios, renda e CadÚnico', [
    linha('Número NIS', c.numero_nis),
    linha('Número SISA', c.numero_sisa),
    linha('Status CadÚnico', c.status_cadunico),
    linha('Possui renda', c.possui_renda),
    linha('Renda mensal', renda),
    linha('Benefícios', beneficios),
    linha('Programas/benefícios (legado)', c.programas_beneficios),
  ].join(''));
}

function renderTrajetoria(c, origensEncaminhamento) {
  const equipamentos = (c.equipamentos_anteriores || []).filter(
    (e) => e?.origem_encaminhamento_id || e?.descricao_outros,
  );
  const tabelaEquip = equipamentos.length
    ? tabelaLista(
      ['Equipamento / centro / projeto'],
      equipamentos.map((e) => [
        obterLabelOrigem(e.origem_encaminhamento_id, origensEncaminhamento, e.descricao_outros),
      ]),
    )
    : '';

  const linhas = [
    linha('Em São Paulo desde', dataBr(c.em_sao_paulo_desde)),
    linha('Em situação de via pública desde', c.rua_desde),
    linha('Relato da trajetória / vida na rua', c.rua_relato),
  ].join('');

  if (!linhas && !tabelaEquip) return '';
  return `
    <section class="secao-ficha">
      <h2>Trajetória / vida na rua</h2>
      ${linhas ? `<table>${linhas}</table>` : ''}
      ${tabelaEquip ? `<div class="subsecao"><h3>Equipamentos anteriores</h3>${tabelaEquip}</div>` : ''}
    </section>
  `;
}

function renderSaude(c) {
  const substancias = (c.substancias || []).filter((s) => s?.tipo);
  const medicamentos = (c.medicamentos || []).filter((m) => m?.nome);
  const internacoes = (c.internacoes || []).filter((i) => i?.onde || i?.periodo);

  const tabelaSubst = substancias.length
    ? tabelaLista(
      ['Substância', 'Desde quando', 'Quantidade'],
      substancias.map((s) => [s.tipo, s.desde_quando, s.quantidade]),
    )
    : '';
  const tabelaMed = medicamentos.length
    ? tabelaLista(
      ['Medicamento', 'Há quanto tempo', 'Modo de uso'],
      medicamentos.map((m) => [m.nome, m.tempo_uso, m.modo_uso]),
    )
    : '';
  const tabelaInt = internacoes.length
    ? tabelaLista(
      ['Onde', 'Período', 'Quem encaminhou'],
      internacoes.map((i) => [i.onde, i.periodo, i.quem_encaminhou]),
    )
    : '';

  const linhas = [
    linha('Histórico de doença na família', c.saude_hist_familia),
    linha('Qual doença na família', c.saude_hist_familia_qual),
    linha('Problema de saúde atual', c.saude_problema),
    linha('Qual problema de saúde', c.saude_problema_qual),
    linha('Possui laudo médico', c.saude_laudo),
    linha('CID', c.saude_cid),
    linha('Trata em outro equipamento', c.saude_outro_equipamento),
    linha('Onde trata', c.saude_outro_equipamento_onde),
    linha('Observações médicas gerais', c.observacoes_saude),
    linha('Acompanhamento CAPS', c.acompanhamento_caps),
    linha('Uso de substâncias (texto legado)', c.uso_substancias),
    linha('Transtornos mentais (texto legado)', c.transtorno_mental),
    linha('Medidas protetivas', c.medidas_protetivas),
  ].join('');

  if (!linhas && !tabelaSubst && !tabelaMed && !tabelaInt) return '';

  return `
    <section class="secao-ficha">
      <h2>Saúde</h2>
      ${linhas ? `<table>${linhas}</table>` : ''}
      ${tabelaMed ? `<div class="subsecao"><h3>Medicamentos de uso contínuo</h3>${tabelaMed}</div>` : ''}
      ${tabelaInt ? `<div class="subsecao"><h3>Internações / desintoxicação</h3>${tabelaInt}</div>` : ''}
      ${tabelaSubst ? `<div class="subsecao"><h3>Substâncias</h3>${tabelaSubst}</div>` : ''}
    </section>
  `;
}

function renderJudiciario(c) {
  return secao('Judiciário, egresso e dados sensíveis', [
    linha('Egresso prisional', c.egresso_prisional),
    linha('Artigo / motivo', c.egresso_artigo_motivo),
    linha('Ano do egresso', c.egresso_ano),
    linha('Usa tornozeleira eletrônica', c.usa_tornozeleira),
    linha('Tem mandado de prisão', c.tem_mandado_prisao),
    linha('Pendência no judiciário', c.pendencia_judiciaria),
    linha('Qual pendência judiciária', c.pendencia_judiciaria_qual),
    linha('Pendência no eleitoral', c.pendencia_eleitoral),
    linha('Qual pendência eleitoral', c.pendencia_eleitoral_qual),
    linha('E-mail pessoal cadastrado', c.email_pessoal),
  ].join(''));
}

const RENDERIZADORES = {
  identificacao: (c, ctx) => renderIdentificacao(c, ctx),
  contato: (c) => renderContato(c),
  familia: (c) => renderFamilia(c),
  documentos_civis: (c) => renderDocumentosCivis(c),
  escolaridade_trabalho: (c) => renderEscolaridadeTrabalho(c),
  beneficios: (c) => renderBeneficios(c),
  trajetoria: (c, ctx) => renderTrajetoria(c, ctx.origensEncaminhamento),
  saude: (c) => renderSaude(c),
  judiciario: (c) => renderJudiciario(c),
};

function normalizarConviventeFicha(convivente) {
  return formatarDadosConviventeParaTela(convivente || {});
}

export function avaliarSecoesComDadosFicha(convivente) {
  const c = normalizarConviventeFicha(convivente);
  const ctx = { listaTecnicos: [], quartos: [], origensEncaminhamento: [] };
  const resultado = {};
  Object.keys(RENDERIZADORES).forEach((id) => {
    const html = RENDERIZADORES[id](c, ctx);
    resultado[id] = Boolean(html?.trim());
  });
  return resultado;
}

function estilosFichaCompletaCss() {
  return `
    @page { size: A4; margin: 12mm 10mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px 28px 32px; font-size: 12px; line-height: 1.35; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; border-bottom: 2px solid #e5e7eb; margin-bottom: 18px; padding-bottom: 14px; }
    .logo { width: 170px; max-height: 64px; object-fit: contain; }
    .titulo { text-align: right; flex: 1; }
    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #0f766e; }
    h3 { margin: 10px 0 4px; font-size: 11px; text-transform: uppercase; color: #374151; }
    p { margin: 3px 0; color: #4b5563; font-size: 11px; }
    .secao-ficha { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
    .subsecao { margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 11px; vertical-align: top; text-align: left; }
    th { width: 30%; background: #f9fafb; color: #374151; font-weight: 700; }
    .tabela-lista th { width: auto; background: #f3f4f6; }
    td.vazio { color: #6b7280; font-style: italic; }
    .identidade-nome { margin-top: 4px; color: #374151; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .assinatura { margin-top: 36px; display: flex; justify-content: flex-end; break-inside: avoid; }
    .linha-assinatura { width: 280px; border-top: 1px solid #111827; text-align: center; padding-top: 8px; font-size: 10px; }
    .rodape-relatorio { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 9px; line-height: 1.4; text-align: center; }
    .direitos-reservados { margin-top: 4px; font-size: 8px; font-weight: 700; }
    .direitos-reservados a { color: #4f46e5; text-decoration: none; }
    .aviso-vazio { padding: 12px; border: 1px dashed #d1d5db; border-radius: 8px; color: #6b7280; text-align: center; }
    button { margin-bottom: 16px; padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: white; cursor: pointer; }
    .ficha-lote { page-break-after: always; break-after: page; margin-bottom: 8px; }
    .ficha-lote:last-child { page-break-after: auto; break-after: auto; }
    .capa-fichas-lote { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
    .capa-fichas-lote h1 { font-size: 18px; color: #0f766e; }
  `;
}

function montarRodapeFichaHtml(identidadeRelatorio, direitosUrl) {
  const rodapeItens = [
    identidadeRelatorio?.relatorio_rodape_linha1,
    identidadeRelatorio?.relatorio_rodape_linha2,
    identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
    identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
    identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
  ].filter(Boolean);

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

export function montarBlocosFichaCompleta(convivente, secoesSelecionadas = [], ctx = {}) {
  const c = normalizarConviventeFicha(convivente);
  const secoes = new Set(secoesSelecionadas);
  const blocos = [];

  secoes.forEach((id) => {
    const render = RENDERIZADORES[id];
    if (!render) return;
    const html = render(c, ctx);
    if (html?.trim()) blocos.push(html);
  });

  return blocos;
}

export function montarCorpoFichaCompletaHtml({
  convivente,
  secoesSelecionadas = [],
  listaTecnicos = [],
  quartos = [],
  origensEncaminhamento = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  titulo = 'Ficha completa do convivente',
  subtituloExtra = '',
  agora = null,
}) {
  const c = normalizarConviventeFicha(convivente);
  const ctx = { listaTecnicos, quartos, origensEncaminhamento };
  const blocos = montarBlocosFichaCompleta(c, secoesSelecionadas, ctx);
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const direitosUrl = obterUrlDireitosReservados();
  const nomeConvivente = c.nome_social || c.nome_completo || 'Convivente';
  const geradoEm = agora || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `
    <header>
      <div>
        <img class="logo" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
        <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
      </div>
      <div class="titulo">
        <h1>${escaparHtml(titulo)}</h1>
        <p>Gerada em ${escaparHtml(geradoEm)} (horário de Brasília)</p>
        ${subtituloExtra ? `<p>${escaparHtml(subtituloExtra)}</p>` : ''}
        <p><strong>${escaparHtml(nomeConvivente)}</strong>${c.numero_institucional ? ` · Prontuário #${escaparHtml(c.numero_institucional)}` : ''}</p>
      </div>
    </header>

    ${
      blocos.length
        ? blocos.join('')
        : '<p class="aviso-vazio">Nenhuma seção selecionada possui dados para impressão.</p>'
    }

    <div class="assinatura">
      <div class="linha-assinatura">Responsável pela conferência</div>
    </div>

    ${montarRodapeFichaHtml(identidadeRelatorio, direitosUrl)}
  `;
}

export function montarHtmlFichasCompletasLote({
  conviventes = [],
  secoesSelecionadas = [],
  listaTecnicos = [],
  quartos = [],
  origensEncaminhamento = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
  descricaoFiltros = '',
}) {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';

  const fichasHtml = conviventes.map((convivente) => `
    <section class="ficha-lote">
      ${montarCorpoFichaCompletaHtml({
        convivente,
        secoesSelecionadas,
        listaTecnicos,
        quartos,
        origensEncaminhamento,
        identidadeRelatorio,
        logoRelatorioDataUrl,
        titulo: 'Ficha completa do convivente',
        subtituloExtra: descricaoFiltros ? `Filtro: ${descricaoFiltros}` : '',
        agora,
      })}
    </section>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Fichas completas filtradas (${conviventes.length})</title>
        <style>
          ${estilosFichaCompletaCss()}
          @media print {
            body { padding: 0; }
            button { display: none; }
            header { margin-bottom: 10px; padding-bottom: 8px; }
            .logo { width: 130px; max-height: 48px; }
            h1 { font-size: 16px; }
            h2 { font-size: 11px; }
            th, td { font-size: 9px; padding: 4px 6px; }
          }
        </style>
      </head>
      <body>
        <button type="button" onclick="window.print()">Imprimir</button>
        <div class="capa-fichas-lote">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <img class="logo" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
              <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
            </div>
            <div class="titulo">
              <h1>Fichas completas — filtro atual</h1>
              <p>Gerado em ${escaparHtml(agora)} (horário de Brasília)</p>
              <p><strong>${conviventes.length}</strong> ficha(s) · ${escaparHtml(descricaoFiltros || 'Sem filtros adicionais')}</p>
            </div>
          </div>
        </div>
        ${fichasHtml}
      </body>
    </html>
  `;
}

export function montarHtmlFichaCompletaConvivente({
  convivente,
  secoesSelecionadas = [],
  listaTecnicos = [],
  quartos = [],
  origensEncaminhamento = [],
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
}) {
  const nomeConvivente = convivente?.nome_social || convivente?.nome_completo || 'Convivente';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha completa - ${escaparHtml(nomeConvivente)}</title>
        <style>
          ${estilosFichaCompletaCss()}
          @media print {
            body { padding: 0; }
            button { display: none; }
            header { margin-bottom: 10px; padding-bottom: 8px; }
            .logo { width: 130px; max-height: 48px; }
            h1 { font-size: 16px; }
            h2 { font-size: 11px; }
            th, td { font-size: 9px; padding: 4px 6px; }
          }
        </style>
      </head>
      <body>
        <button type="button" onclick="window.print()">Imprimir</button>
        ${montarCorpoFichaCompletaHtml({
          convivente,
          secoesSelecionadas,
          listaTecnicos,
          quartos,
          origensEncaminhamento,
          identidadeRelatorio,
          logoRelatorioDataUrl,
        })}
      </body>
    </html>
  `;
}
