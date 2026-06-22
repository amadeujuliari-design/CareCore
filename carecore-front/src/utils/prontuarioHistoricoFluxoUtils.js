export const FLUXO_DIAS_PADRAO = 7;
export const HISTORICO_DIAS_PADRAO = 30;
export const LISTAGEM_OPERACIONAL_DIAS_PADRAO = 7;
export const REGISTROS_POR_PAGINA_PRONTUARIO = 30;
export const REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO = 10;

export const TIPOS_REGISTRO_FLUXO_PRONTUARIO = [
  { valor: '', label: 'Todos os tipos' },
  { valor: 'Entrada', label: 'Entrada' },
  { valor: 'Saída', label: 'Saída' },
  { valor: 'Café da manhã', label: 'Café da manhã' },
  { valor: 'Almoço', label: 'Almoço' },
  { valor: 'Jantar', label: 'Jantar' },
  { valor: 'Lanche noturno', label: 'Lanche noturno' },
  { valor: 'Banho', label: 'Banho' },
  { valor: 'Cobertor', label: 'Cobertor (retirada/entrega)' },
  { valor: 'Toalha', label: 'Toalha (retirada/entrega)' },
  { valor: 'Bagageiro', label: 'Bagageiro' },
  { valor: 'Documentos', label: 'Documentos (guardar/retirar)' },
  { valor: 'Lavanderia', label: 'Lavanderia' },
  { valor: 'Pertences recolhidos', label: 'Pertences recolhidos' },
];

export function formatarDataIsoLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function calcularDataInicioPadrao(dias) {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() - Math.max(Number(dias) - 1, 0));
  return formatarDataIsoLocal(data);
}

export function dataHojeIsoLocal() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return formatarDataIsoLocal(data);
}

export function criarFiltrosFluxoPadrao() {
  return {
    dataInicio: calcularDataInicioPadrao(FLUXO_DIAS_PADRAO),
    dataFim: dataHojeIsoLocal(),
    tipoRegistro: '',
    busca: '',
    deslocamento: 0,
  };
}

export function criarFiltrosHistoricoPadrao() {
  return {
    dataInicio: calcularDataInicioPadrao(HISTORICO_DIAS_PADRAO),
    dataFim: dataHojeIsoLocal(),
    origemInformacao: '',
    busca: '',
    deslocamento: 0,
  };
}

export function criarFiltrosListagemOperacionalPadrao() {
  return {
    dataInicio: calcularDataInicioPadrao(LISTAGEM_OPERACIONAL_DIAS_PADRAO),
    dataFim: dataHojeIsoLocal(),
    busca: '',
    deslocamento: 0,
  };
}

export function montarParamsListagemOperacional(filtros, extras = {}, { limite = REGISTROS_POR_PAGINA_PRONTUARIO } = {}) {
  const params = {
    limite,
    deslocamento: filtros.deslocamento || 0,
    ...extras,
  };

  if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
  if (filtros.dataFim) params.data_fim = filtros.dataFim;
  if (filtros.busca?.trim()) params.busca = filtros.busca.trim();

  return params;
}

export function montarParamsFluxoProntuario(filtros, { limite = REGISTROS_POR_PAGINA_PRONTUARIO } = {}) {
  const params = {
    limite,
    deslocamento: filtros.deslocamento || 0,
  };

  if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
  if (filtros.dataFim) params.data_fim = filtros.dataFim;
  if (filtros.tipoRegistro) params.tipo_registro = filtros.tipoRegistro;
  if (filtros.busca?.trim()) params.busca = filtros.busca.trim();

  return params;
}

export function montarParamsHistoricoProntuario(filtros, { limite = REGISTROS_POR_PAGINA_PRONTUARIO } = {}) {
  const params = {
    limite,
    deslocamento: filtros.deslocamento || 0,
  };

  if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
  if (filtros.dataFim) params.data_fim = filtros.dataFim;
  if (filtros.origemInformacao?.trim()) params.origem_informacao = filtros.origemInformacao.trim();
  if (filtros.busca?.trim()) params.busca = filtros.busca.trim();

  return params;
}

export function resumirPeriodoFiltro(dataInicio, dataFim) {
  if (!dataInicio && !dataFim) return 'Todo o período';
  if (dataInicio && dataFim) {
    return `${new Date(`${dataInicio}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')}`;
  }
  if (dataInicio) {
    return `A partir de ${new Date(`${dataInicio}T00:00:00`).toLocaleDateString('pt-BR')}`;
  }
  return `Até ${new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')}`;
}
