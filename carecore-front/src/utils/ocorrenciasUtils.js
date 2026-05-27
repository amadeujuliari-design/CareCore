export const PRIORIDADES_OCORRENCIA = ['Todas', 'Baixa', 'Média', 'Alta', 'Crítica'];
export const PESO_PRIORIDADE = { Baixa: 1, Média: 2, Alta: 3, Crítica: 4 };

export function normalizarPrioridade(valor) {
  if (!valor) return 'Média';
  const v = String(valor).trim().toLowerCase();
  if (['critica', 'crítica', 'critico', 'crítico'].includes(v)) return 'Crítica';
  if (['alta', 'alto'].includes(v)) return 'Alta';
  if (['media', 'média', 'medio', 'médio'].includes(v)) return 'Média';
  if (['baixa', 'baixo'].includes(v)) return 'Baixa';
  return 'Média';
}

export function classesPrioridade(prioridade) {
  const p = normalizarPrioridade(prioridade);
  return {
    Crítica: 'bg-red-100 text-red-700 border-red-200',
    Alta: 'bg-orange-100 text-orange-700 border-orange-200',
    Média: 'bg-amber-100 text-amber-700 border-amber-200',
    Baixa: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }[p] || 'bg-gray-100 text-gray-700 border-gray-200';
}

export function filtrarOcorrencias(ocorrencias, filtroPrioridade, filtroStatus) {
  return ocorrencias.filter((ocorrencia) => {
    const prioridade = normalizarPrioridade(ocorrencia.prioridade);
    const status = ocorrencia.status_resolucao === 'Resolvido' ? 'Resolvido' : 'Pendente';

    const prioridadeOk = filtroPrioridade === 'Todas' || prioridade === filtroPrioridade;
    const statusOk = filtroStatus === 'Todos' || status === filtroStatus;

    return prioridadeOk && statusOk;
  });
}

export function ordenarOcorrencias(ocorrencias, idUsuarioLogado) {
  return [...ocorrencias].sort((a, b) => {
    const aResolvido = a.status_resolucao === 'Resolvido';
    const bResolvido = b.status_resolucao === 'Resolvido';

    const aAcaoMinha = !aResolvido && a.tecnico_responsavel_id === idUsuarioLogado;
    const bAcaoMinha = !bResolvido && b.tecnico_responsavel_id === idUsuarioLogado;

    if (aAcaoMinha && !bAcaoMinha) return -1;
    if (!aAcaoMinha && bAcaoMinha) return 1;

    if (!aResolvido && bResolvido) return -1;
    if (aResolvido && !bResolvido) return 1;

    const pesoA = PESO_PRIORIDADE[normalizarPrioridade(a.prioridade)] || 2;
    const pesoB = PESO_PRIORIDADE[normalizarPrioridade(b.prioridade)] || 2;

    if (pesoA !== pesoB) return pesoB - pesoA;

    return new Date(b.data_ocorrencia) - new Date(a.data_ocorrencia);
  });
}

export function resumirPrioridadesOcorrencias(ocorrencias) {
  return ocorrencias.reduce((acc, oc) => {
    const prioridade = normalizarPrioridade(oc.prioridade);
    const pendente = oc.status_resolucao !== 'Resolvido';
    acc[prioridade] = acc[prioridade] || { total: 0, pendentes: 0 };
    acc[prioridade].total += 1;
    if (pendente) acc[prioridade].pendentes += 1;
    return acc;
  }, {});
}

export function calcularResumoRelatorioOcorrencias(lista) {
  const resultado = {
    total: lista.length,
    pendentes: 0,
    resolvidas: 0,
    altaCriticaPendentes: 0,
    porPrioridade: { Baixa: 0, Média: 0, Alta: 0, Crítica: 0 },
    porTipo: {},
    porTecnico: {},
  };

  lista.forEach((oc) => {
    const prioridade = normalizarPrioridade(oc.prioridade);
    const resolvida = oc.status_resolucao === 'Resolvido';
    const tipo = oc.tipo_ocorrencia || 'Não informado';
    const tecnico = oc.tecnico_responsavel_nome || oc.tecnico_nome || oc.responsavel_nome || 'Equipe';

    resultado.porPrioridade[prioridade] = (resultado.porPrioridade[prioridade] || 0) + 1;
    resultado.porTipo[tipo] = (resultado.porTipo[tipo] || 0) + 1;
    resultado.porTecnico[tecnico] = (resultado.porTecnico[tecnico] || 0) + 1;

    if (resolvida) {
      resultado.resolvidas += 1;
    } else {
      resultado.pendentes += 1;
      if (['Alta', 'Crítica'].includes(prioridade)) {
        resultado.altaCriticaPendentes += 1;
      }
    }
  });

  return resultado;
}

export function montarRelatorioOcorrencias(ocorrencias, ocorrenciasFiltradas) {
  const base = Array.isArray(ocorrencias) ? ocorrencias : [];
  const filtradas = Array.isArray(ocorrenciasFiltradas) ? ocorrenciasFiltradas : [];

  return {
    geral: calcularResumoRelatorioOcorrencias(base),
    filtrado: calcularResumoRelatorioOcorrencias(filtradas),
  };
}
