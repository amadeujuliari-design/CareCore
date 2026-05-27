export const ABAS_RELATORIOS = [
  { id: 'geral', label: 'Visao Geral' },
  { id: 'conviventes', label: 'Conviventes' },
  { id: 'rotina', label: 'Rotina' },
  { id: 'ocorrencias', label: 'Ocorrencias' },
  { id: 'sisa', label: 'SISA / Convenio' },
  { id: 'acomodacoes', label: 'Acomodacoes' },
  { id: 'documentacao', label: 'Documentacao' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'auditoria', label: 'Auditoria' },
];

export function criarFiltrosRelatoriosIniciais() {
  return {
    dataInicio: '',
    dataFim: '',
    tecnicoId: '',
    statusConvivente: 'Todos',
    statusOcorrencia: 'Todos',
    prioridadeOcorrencia: 'Todas',
    somentePendencias: false,
    sisaAno: new Date().getFullYear(),
    sisaMes: new Date().getMonth() + 1,
    sisaStatusLancamento: 'todos',
    acomodacaoStatusLeito: 'Todos',
    acomodacaoModalidade: 'Todas',
    acomodacaoPublico: 'Todos',
    busca: '',
  };
}

export function descreverFiltrosAtivosRelatorios({ aba, filtros, tecnicos }) {
  const lista = [];

  if (filtros.dataInicio) lista.push(`Inicio: ${filtros.dataInicio}`);
  if (filtros.dataFim) lista.push(`Fim: ${filtros.dataFim}`);
  if (filtros.tecnicoId) {
    const tecnico = tecnicos.find((t) => t.id === filtros.tecnicoId);
    lista.push(`Tecnico: ${tecnico?.nome || filtros.tecnicoId}`);
  }
  if (filtros.statusConvivente !== 'Todos') lista.push(`Status convivente: ${filtros.statusConvivente}`);
  if (filtros.statusOcorrencia !== 'Todos') lista.push(`Status ocorrencia: ${filtros.statusOcorrencia}`);
  if (filtros.prioridadeOcorrencia !== 'Todas') lista.push(`Prioridade: ${filtros.prioridadeOcorrencia}`);
  if (filtros.somentePendencias) lista.push('Somente pendencias');
  if (aba === 'sisa') {
    lista.push(`SISA: ${String(filtros.sisaMes).padStart(2, '0')}/${filtros.sisaAno}`);
    if (filtros.sisaStatusLancamento !== 'todos') {
      lista.push(`Lancamento SISA: ${filtros.sisaStatusLancamento === 'lancados' ? 'Lancados' : 'Pendentes'}`);
    }
  }
  if (aba === 'acomodacoes') {
    if (filtros.acomodacaoStatusLeito !== 'Todos') lista.push(`Status leito: ${filtros.acomodacaoStatusLeito}`);
    if (filtros.acomodacaoModalidade !== 'Todas') lista.push(`Modalidade: ${filtros.acomodacaoModalidade}`);
    if (filtros.acomodacaoPublico !== 'Todos') lista.push(`Publico: ${filtros.acomodacaoPublico}`);
  }
  if (filtros.busca.trim()) lista.push(`Busca: ${filtros.busca.trim()}`);

  return lista;
}

export function contar(lista, predicado) {
  return (Array.isArray(lista) ? lista : []).filter(predicado).length;
}

export function porcentagem(parte, total) {
  if (!total) return 0;
  return Math.round((Number(parte || 0) / Number(total)) * 100);
}

export function normalizarPrioridade(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (['critica', 'crítica', 'critico', 'crítico'].includes(v)) return 'Crítica';
  if (['alta', 'alto'].includes(v)) return 'Alta';
  if (['baixa', 'baixo'].includes(v)) return 'Baixa';
  return 'Média';
}

export function dataDentroDoPeriodo(valor, dataInicio, dataFim) {
  if (!dataInicio && !dataFim) return true;
  if (!valor) return false;

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return false;

  if (dataInicio) {
    const inicio = new Date(`${dataInicio}T00:00:00`);
    if (data < inicio) return false;
  }

  if (dataFim) {
    const fim = new Date(`${dataFim}T23:59:59`);
    if (data > fim) return false;
  }

  return true;
}

export function campoTexto(item, campos) {
  return campos
    .map((campo) => item?.[campo] || '')
    .join(' ')
    .toLowerCase();
}

export function formatarData(valor) {
  if (!valor) return '-';
  try {
    return new Date(valor).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

export function formatarDataHora(valor) {
  if (!valor) return '-';
  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}
