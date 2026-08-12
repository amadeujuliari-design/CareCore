export const NFP_RELATORIOS_CATALOGO = [
  {
    id: 'cupons-fila',
    path: '/nfp/relatorios/cupons',
    titulo: 'Cupons lidos / fila / enviados',
    descricao: 'Período, captador/unidade, status e busca — totais e detalhe da fila operacional.',
    tipo: 'Operacional',
  },
  {
    id: 'rateio-consolidado',
    path: '/nfp/relatorios/rateio-consolidado',
    titulo: 'Rateio consolidado',
    descricao: 'Totais por competência e ranking por agente (analítico gerencial).',
    tipo: 'Consolidado',
  },
  {
    id: 'rateio-detalhado',
    path: '/nfp/relatorios/rateio-detalhado',
    titulo: 'Rateio detalhado',
    descricao: 'Linhas por CNPJ, loja e origem na competência selecionada.',
    tipo: 'Analítico',
  },
];

export function moneyRelatorioNfp(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function rotuloOrigemRateio(origem) {
  const valor = String(origem || '').trim().toUpperCase();
  if (!valor) return '—';
  if (valor === 'DIRETO_AEB') return 'Direto AEB';
  if (valor === 'DOADOR_AUTOMATICO_AEB') return 'Doador automático AEB';
  if (valor.startsWith('DOADOR_AUTOMATICO_')) {
    return `Doador automático ${valor.replace('DOADOR_AUTOMATICO_', '')}`;
  }
  return valor;
}

export function formatarNumeroRelatorioNfp(valor, casas = 2) {
  const n = Number(valor || 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export const COLUNAS_RATEIO_CONSOLIDADO_COMP = [
  'Competência',
  'Total créditos',
  'Parte agente',
  'Parte AEB',
  'Doador automático',
  'Direto AEB',
  'Linhas',
];

export const COLUNAS_RATEIO_CONSOLIDADO_AGENTE = [
  'Agente',
  'Total créditos',
  'Parte agente',
  'Parte AEB',
  'Doador automático',
  'Direto AEB',
  'Linhas',
];

export const COLUNAS_RATEIO_DETALHADO = [
  'CNPJ',
  'Loja',
  'Captador',
  'Origem',
  'Qtd',
  'Retorno',
  'Parte agente',
  'Parte AEB',
  'Final',
  'Competência',
];

export function montarExportacaoRateioConsolidadoComp(relatorio) {
  return (relatorio?.por_competencia || []).map((item) => ({
    Competência: item.competencia,
    'Total créditos': formatarNumeroRelatorioNfp(item.total_creditos),
    'Parte agente': formatarNumeroRelatorioNfp(item.parte_agente),
    'Parte AEB': formatarNumeroRelatorioNfp(item.parte_aeb),
    'Doador automático': formatarNumeroRelatorioNfp(item.doador_auto),
    'Direto AEB': formatarNumeroRelatorioNfp(item.direto_aeb),
    Linhas: item.qtd_linhas ?? 0,
  }));
}

export function montarExportacaoRateioConsolidadoAgente(relatorio) {
  return (relatorio?.por_agente || []).map((item) => ({
    Agente: item.agente,
    'Total créditos': formatarNumeroRelatorioNfp(item.total_creditos),
    'Parte agente': formatarNumeroRelatorioNfp(item.parte_agente),
    'Parte AEB': formatarNumeroRelatorioNfp(item.parte_aeb),
    'Doador automático': formatarNumeroRelatorioNfp(item.doador_auto),
    'Direto AEB': formatarNumeroRelatorioNfp(item.direto_aeb),
    Linhas: item.qtd_linhas ?? 0,
  }));
}

export function montarExportacaoRateioDetalhado(relatorio) {
  return (relatorio?.linhas || []).map((item) => ({
    CNPJ: item.cnpj || '',
    Loja: item.loja || '',
    Captador: item.captador || '',
    Origem: rotuloOrigemRateio(item.origem),
    Qtd: item.qtd ?? 0,
    Retorno: formatarNumeroRelatorioNfp(item.retorno),
    'Parte agente': formatarNumeroRelatorioNfp(item.valor_agente ?? item.valor_diego),
    'Parte AEB': formatarNumeroRelatorioNfp(item.valor_aeb),
    Final: formatarNumeroRelatorioNfp(item.final),
    Competência: item.competencia || '',
  }));
}

export const STATUS_CUPONS_RELATORIO = [
  { value: 'checando', label: 'Checando SEFAZ' },
  { value: 'pendente', label: 'Pendente (fila)' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'erro', label: 'Erro' },
  { value: 'rejeitado_cpf', label: 'Rejeitado CPF' },
  { value: 'rejeitado_prazo', label: 'Rejeitado prazo' },
];

export function rotuloStatusCupomRelatorio(status) {
  const item = STATUS_CUPONS_RELATORIO.find((s) => s.value === status);
  return item?.label || status || '—';
}

export const COLUNAS_CUPONS_POR_CAPTADOR = [
  'Captador',
  'Lidos',
  'Pendentes',
  'Reservados',
  'Enviados',
  'Erros',
  'Rejeitados CPF',
  'Rejeitados prazo',
  'Checando',
];

export const COLUNAS_CUPONS_DETALHE = [
  'Chave',
  'Captador',
  'Status',
  'CNPJ emitente',
  'Emissão (ref.)',
  'Lido em',
  'Enviado em',
  'Mensagem',
];

export function montarExportacaoCuponsPorCaptador(relatorio) {
  return (relatorio?.por_captador || []).map((item) => ({
    Captador: item.captador || '',
    Lidos: item.lidos ?? 0,
    Pendentes: item.pendentes ?? 0,
    Reservados: item.reservados ?? 0,
    Enviados: item.enviados ?? 0,
    Erros: item.erros ?? 0,
    'Rejeitados CPF': item.rejeitados_cpf ?? 0,
    'Rejeitados prazo': item.rejeitados_prazo ?? 0,
    Checando: item.checando ?? 0,
  }));
}

export function montarExportacaoCuponsDetalhe(relatorio) {
  return (relatorio?.linhas || []).map((item) => ({
    Chave: item.chave || '',
    Captador: item.captador || '',
    Status: rotuloStatusCupomRelatorio(item.status),
    'CNPJ emitente': item.cnpj_emitente || '',
    'Emissão (ref.)': item.data_emissao_ref || '',
    'Lido em': item.lido_em || '',
    'Enviado em': item.enviado_em || '',
    Mensagem: item.mensagem || '',
  }));
}
