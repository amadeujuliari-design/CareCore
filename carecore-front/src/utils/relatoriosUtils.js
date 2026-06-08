export const ABAS_RELATORIOS = [
  { id: 'conviventes', label: 'Conviventes' },
  { id: 'rotina', label: 'Rotina' },
  { id: 'ocorrencias', label: 'Ocorrências' },
  { id: 'acomodacoes', label: 'Acomodações' },
  { id: 'documentacao', label: 'Documentação' },
  { id: 'carteirinhas', label: 'Carteirinhas' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'auditoria', label: 'Auditoria' },
  { id: 'evolucao', label: 'Evolução' },
  { id: 'personalizacao', label: 'Personalização' },
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
    acomodacaoStatusLeito: 'Todos',
    acomodacaoModalidade: 'Todas',
    acomodacaoPublico: 'Todos',
    busca: '',
  };
}

export function descreverFiltrosAtivosRelatorios({ aba, filtros, tecnicos }) {
  const lista = [];

  if (filtros.dataInicio) lista.push(`Início: ${formatarData(filtros.dataInicio)}`);
  if (filtros.dataFim) lista.push(`Fim: ${formatarData(filtros.dataFim)}`);
  if (filtros.tecnicoId) {
    const tecnico = tecnicos.find((t) => t.id === filtros.tecnicoId);
    lista.push(`Técnico: ${tecnico?.nome || filtros.tecnicoId}`);
  }
  if (filtros.statusConvivente !== 'Todos') lista.push(`Status convivente: ${filtros.statusConvivente}`);
  if (filtros.statusOcorrencia !== 'Todos') lista.push(`Status ocorrência: ${filtros.statusOcorrencia}`);
  if (filtros.prioridadeOcorrencia !== 'Todas') lista.push(`Prioridade: ${filtros.prioridadeOcorrencia}`);
  if (filtros.somentePendencias) lista.push('Somente pendências');
  if (aba === 'acomodacoes') {
    if (filtros.acomodacaoStatusLeito !== 'Todos') lista.push(`Status leito: ${filtros.acomodacaoStatusLeito}`);
    if (filtros.acomodacaoModalidade !== 'Todas') lista.push(`Modalidade: ${filtros.acomodacaoModalidade}`);
    if (filtros.acomodacaoPublico !== 'Todos') lista.push(`Público: ${filtros.acomodacaoPublico}`);
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
    const [ano, mes, dia] = String(valor).split('-');
    return `${dia}/${mes}/${ano}`;
  }

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
