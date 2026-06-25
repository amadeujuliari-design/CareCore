export const FILTROS_ATENDIMENTO_SISA = [
  { valor: 'todos', label: 'Todos os ativos' },
  { valor: 'com_presenca', label: 'Com presença' },
  { valor: 'sem_presenca', label: 'Sem presença' },
  { valor: 'entrada', label: 'Com entrada' },
  { valor: 'saida', label: 'Com saída' },
  { valor: 'alimentacao', label: 'Com alimentação' },
  { valor: 'cafe', label: 'Com café' },
  { valor: 'almoco', label: 'Com almoço' },
  { valor: 'jantar', label: 'Com jantar' },
  { valor: 'lanche', label: 'Com lanche' },
  { valor: 'banho', label: 'Com banho' },
  { valor: 'com_atendimento', label: 'Com qualquer interação' },
  { valor: 'entrada_almoco', label: 'Entrada + almoço' },
  { valor: 'sem_atendimento', label: 'Sem interação' },
];

export const TIPOS_DIVERGENCIA_SISA = [
  { valor: 'todos', label: 'Todos os tipos' },
  { valor: 'SISA_MENOR', label: 'SISA menor (perda)' },
  { valor: 'SISA_MAIOR', label: 'SISA maior' },
  { valor: 'OK', label: 'Compatível' },
  { valor: 'SEM_BASE_ANTERIOR', label: 'Sem base anterior' },
  { valor: 'CONVIVENTE_NAO_ENCONTRADO', label: 'Não encontrado' },
];

export const PRIORIDADES_DIVERGENCIA_SISA = [
  { valor: 'todas', label: 'Todas as prioridades' },
  { valor: 'Crítica', label: 'Crítica' },
  { valor: 'Alta', label: 'Alta' },
  { valor: 'Média', label: 'Média' },
  { valor: 'Baixa', label: 'Baixa' },
];

export const STATUS_TRATATIVA_SISA = [
  'Pendente',
  'Em análise',
  'Justificado',
  'Resolvido',
];

export const STATUS_TRATATIVA_FILTRO = [
  { valor: 'todos', label: 'Todas as tratativas' },
  ...STATUS_TRATATIVA_SISA.map(status => ({ valor: status, label: status })),
];

export const STATUS_CONVIVENTE_FILTRO = [
  { valor: 'todos', label: 'Todos os conviventes' },
  { valor: 'Ativo', label: 'Somente ativos' },
  { valor: 'Inativo', label: 'Somente inativos' },
  { valor: 'sem_cadastro', label: 'Sem cadastro vinculado' },
];

export const DESLIGAMENTO_FILTRO = [
  { valor: 'todos', label: 'Com ou sem desligamento' },
  { valor: 'com', label: 'Com desligamento na planilha' },
  { valor: 'sem', label: 'Sem desligamento na planilha' },
];

export const FILTROS_DIVERGENCIA_PADRAO = {
  busca: '',
  tipo: 'todos',
  prioridade: 'todas',
  statusTratativa: 'todos',
  statusConvivente: 'todos',
  desligamento: 'todos',
  somenteDiferenca: false,
  difMinima: 0,
};

export const IMPORTACOES_POR_PAGINA_SISA = 30;
export const DIVERGENCIAS_POR_PAGINA_SISA = 30;
export const EXPORT_DIVERGENCIAS_SISA_LIMITE = 5000;

export function montarParamsDivergenciasSisaApi(filtros = {}, paginacao = {}) {
  const f = filtros || FILTROS_DIVERGENCIA_PADRAO;

  return {
    limit: paginacao.limit ?? DIVERGENCIAS_POR_PAGINA_SISA,
    offset: paginacao.offset ?? 0,
    busca: (f.busca || '').trim() || undefined,
    tipo: f.tipo !== 'todos' ? f.tipo : undefined,
    prioridade: f.prioridade !== 'todas' ? f.prioridade : undefined,
    status_tratativa: f.statusTratativa !== 'todos' ? f.statusTratativa : undefined,
    status_convivente: f.statusConvivente !== 'todos' ? f.statusConvivente : undefined,
    desligamento: f.desligamento !== 'todos' ? f.desligamento : undefined,
    somente_diferenca: f.somenteDiferenca ? true : undefined,
    dif_minima: Number(f.difMinima || 0) > 0 ? Number(f.difMinima) : undefined,
  };
}

export function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function itemAtendeFiltroSisa(item, filtro) {
  if (!filtro || filtro === 'todos') return true;

  const temEntrada = Boolean(item.entrada) || Number(item.entradas || 0) > 0;
  const temSaida = Boolean(item.saida) || Number(item.saidas || 0) > 0;
  const temCafe = item.cafe === 'Sim' || Number(item.cafes || 0) > 0;
  const temAlmoco = item.almoco === 'Sim' || Number(item.almocos || 0) > 0;
  const temJantar = item.jantar === 'Sim' || Number(item.jantares || 0) > 0;
  const temLanche = item.lanche === 'Sim' || Number(item.lanches || 0) > 0;
  const temBanho = item.banho === 'Sim' || Number(item.banhos || 0) > 0;
  const temAlimentacao = temCafe || temAlmoco || temJantar || temLanche;
  const temMovimento = Number(item.total_movimentos || 0) > 0;
  const temPresenca = item.presenca === 'Sim' || Number(item.dias_presentes || item.total_atendimentos || 0) > 0;
  const temAtendimento = temMovimento || temAlimentacao || temEntrada || temSaida || temBanho;

  if (filtro === 'com_presenca') return temPresenca;
  if (filtro === 'sem_presenca') return !temPresenca;
  if (filtro === 'com_atendimento') return temAtendimento;
  if (filtro === 'entrada') return temEntrada;
  if (filtro === 'saida') return temSaida;
  if (filtro === 'alimentacao') return temAlimentacao;
  if (filtro === 'cafe') return temCafe;
  if (filtro === 'almoco') return temAlmoco;
  if (filtro === 'jantar') return temJantar;
  if (filtro === 'lanche') return temLanche;
  if (filtro === 'banho') return temBanho;
  if (filtro === 'entrada_almoco') return temEntrada && temAlmoco;
  if (filtro === 'sem_atendimento') return !temAtendimento;

  return true;
}

export function filtrarItensAtendimentoSisa(items = [], filtroAtendimento = 'todos') {
  return (items || []).filter(item => itemAtendeFiltroSisa(item, filtroAtendimento));
}

export function paginarItensSisa(items = [], pagina = 1, itensPorPagina = 20) {
  const totalPaginas = Math.max(1, Math.ceil(items.length / itensPorPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;

  return {
    fim,
    inicio,
    itensPaginados: items.slice(inicio, fim),
    paginaSegura,
    totalPaginas,
  };
}

export function calcularResumoMensalSisa(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.conviventes += 1;
      acc.total_atendimentos += Number(item.total_atendimentos || 0);
      acc.total_justificativas += Number(item.dias_justificados || 0);
      acc.total_cafes += Number(item.cafes || 0);
      acc.total_almocos += Number(item.almocos || 0);
      acc.total_jantares += Number(item.jantares || 0);
      acc.total_lanches += Number(item.lanches || 0);
      acc.total_refeicoes_extras += Number(item.refeicoes_extras || 0);
      acc.total_banhos += Number(item.banhos || 0);
      acc.total_entradas += Number(item.entradas || 0);
      acc.total_saidas += Number(item.saidas || 0);
      acc.total_retornos_rapidos += Number(item.retornos_rapidos || 0);
      return acc;
    },
    {
      conviventes: 0,
      total_atendimentos: 0,
      total_justificativas: 0,
      total_cafes: 0,
      total_almocos: 0,
      total_jantares: 0,
      total_lanches: 0,
      total_refeicoes_extras: 0,
      total_banhos: 0,
      total_entradas: 0,
      total_saidas: 0,
      total_retornos_rapidos: 0,
      lancados_sisa: 0,
      pendentes_sisa: 0,
    },
  );
}

export function calcularResumoDiarioSisa(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.conviventes += 1;
      if (item.presenca === 'Sim') acc.presentes += 1;
      if (item.presenca !== 'Sim') acc.ausentes += 1;
      if (item.ausente_operacional === 'Sim') acc.ausentes_operacionais += 1;
      if (item.presenca_por_justificativa === 'Sim') acc.presentes_por_justificativa += 1;
      acc.cafes += Number(item.cafes || (item.cafe === 'Sim' ? 1 : 0));
      acc.almocos += Number(item.almocos || (item.almoco === 'Sim' ? 1 : 0));
      acc.jantares += Number(item.jantares || (item.jantar === 'Sim' ? 1 : 0));
      acc.lanches += Number(item.lanches || (item.lanche === 'Sim' ? 1 : 0));
      acc.refeicoes_extras += Number(item.refeicoes_extras || 0);
      if (item.banho === 'Sim') acc.banhos += 1;
      if (item.entrada) acc.entradas += 1;
      if (item.saida) acc.saidas += 1;
      return acc;
    },
    {
      conviventes: 0,
      presentes: 0,
      presentes_por_justificativa: 0,
      ausentes: 0,
      ausentes_operacionais: 0,
      cafes: 0,
      almocos: 0,
      jantares: 0,
      lanches: 0,
      refeicoes_extras: 0,
      banhos: 0,
      entradas: 0,
      saidas: 0,
    },
  );
}

export function montarResumoCardsDiariosSisa(resumoDiario, dataDiariaFormatada, filtroAtendimentoLabel = 'Registros') {
  return [
    { titulo: filtroAtendimentoLabel, valor: resumoDiario.conviventes, detalhe: 'Total no recorte filtrado' },
    { titulo: 'Presentes', valor: resumoDiario.presentes, detalhe: dataDiariaFormatada },
    { titulo: 'Ausentes', valor: resumoDiario.ausentes_operacionais ?? resumoDiario.ausentes, detalhe: 'Saída ontem sem retorno hoje' },
    { titulo: 'Entradas', valor: resumoDiario.entradas, detalhe: dataDiariaFormatada },
    { titulo: 'Saídas', valor: resumoDiario.saidas, detalhe: dataDiariaFormatada },
    { titulo: 'Justificadas', valor: resumoDiario.presentes_por_justificativa, detalhe: 'Presença por ausência justificada' },
    { titulo: 'Cafés', valor: resumoDiario.cafes, detalhe: dataDiariaFormatada },
    { titulo: 'Almoços', valor: resumoDiario.almocos, detalhe: dataDiariaFormatada },
    { titulo: 'Jantares', valor: resumoDiario.jantares, detalhe: dataDiariaFormatada },
    { titulo: 'Lanches', valor: resumoDiario.lanches, detalhe: dataDiariaFormatada },
    { titulo: 'Extras', valor: resumoDiario.refeicoes_extras, detalhe: 'Refeições repetidas' },
    { titulo: 'Banhos', valor: resumoDiario.banhos, detalhe: dataDiariaFormatada },
  ];
}

export function aplicarFiltrosDivergencias(divergencias, filtros) {
  const f = filtros || FILTROS_DIVERGENCIA_PADRAO;
  const busca = (f.busca || '').trim().toLowerCase();
  const difMinima = Number(f.difMinima || 0);

  return (divergencias || []).filter((item) => {
    if (f.tipo !== 'todos' && item.tipo !== f.tipo) return false;
    if (f.prioridade !== 'todas' && item.prioridade !== f.prioridade) return false;

    if (f.statusTratativa !== 'todos' && (item.status || 'Pendente') !== f.statusTratativa) {
      return false;
    }

    if (f.statusConvivente !== 'todos') {
      if (f.statusConvivente === 'sem_cadastro') {
        if (item.convivente_id) return false;
      } else if ((item.status_convivente || '') !== f.statusConvivente) {
        return false;
      }
    }

    if (f.desligamento === 'com' && !item.tem_desligamento) return false;
    if (f.desligamento === 'sem' && item.tem_desligamento) return false;

    if (f.somenteDiferenca && Number(item.diferenca || 0) === 0) return false;

    if (difMinima > 0 && Math.abs(Number(item.diferenca || 0)) < difMinima) return false;

    if (busca) {
      const alvo = `${item.nome_convivente || ''} ${item.numero_sisa || ''}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }

    return true;
  });
}

export function descreverFiltrosDivergencias(filtros) {
  const f = filtros || FILTROS_DIVERGENCIA_PADRAO;
  const partes = [];

  if (f.tipo !== 'todos') {
    partes.push(`Tipo: ${TIPOS_DIVERGENCIA_SISA.find(o => o.valor === f.tipo)?.label || f.tipo}`);
  }
  if (f.prioridade !== 'todas') partes.push(`Prioridade: ${f.prioridade}`);
  if (f.statusTratativa !== 'todos') partes.push(`Tratativa: ${f.statusTratativa}`);
  if (f.statusConvivente !== 'todos') {
    partes.push(STATUS_CONVIVENTE_FILTRO.find(o => o.valor === f.statusConvivente)?.label || f.statusConvivente);
  }
  if (f.desligamento !== 'todos') {
    partes.push(DESLIGAMENTO_FILTRO.find(o => o.valor === f.desligamento)?.label || f.desligamento);
  }
  if (f.somenteDiferenca) partes.push('Somente com diferença');
  if (Number(f.difMinima || 0) > 0) partes.push(`Diferença mínima: ${f.difMinima} dia(s)`);
  if ((f.busca || '').trim()) partes.push(`Busca: "${f.busca.trim()}"`);

  return partes.length ? partes.join(' · ') : 'Sem filtros aplicados';
}

export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatarDataPt(valor) {
  if (!valor) return '-';
  return String(valor).split('-').reverse().join('/');
}

export function formatarTipoDivergencia(tipo) {
  const labels = {
    OK: 'Compatível',
    SISA_MENOR: 'SISA menor que CareCore+',
    SISA_MAIOR: 'SISA maior que CareCore+',
    SEM_BASE_ANTERIOR: 'Sem base anterior',
    CONVIVENTE_NAO_ENCONTRADO: 'Convivente não encontrado',
  };

  return labels[tipo] || tipo;
}
