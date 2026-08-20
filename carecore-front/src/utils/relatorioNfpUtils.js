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
  'Fonte',
  'Número nota',
  'Qtd',
  'Retorno',
  'Retorno loja',
  'Retorno CPF',
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

function numeroExportacao(valor) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function montarExportacaoRateioDetalhado(relatorio) {
  return (relatorio?.linhas || []).map((item) => ({
    CNPJ: item.cnpj || '',
    Loja: item.loja || '',
    Captador: item.captador || '',
    Origem: rotuloOrigemRateio(item.origem),
    Fonte: item.fonte || '—',
    'Número nota': item.numero_nota || '',
    Qtd: item.qtd ?? 0,
    Retorno: formatarNumeroRelatorioNfp(item.retorno),
    'Retorno loja': formatarNumeroRelatorioNfp(item.retorno_loja ?? item.retorno),
    'Retorno CPF': formatarNumeroRelatorioNfp(item.retorno_cpf ?? 0),
    'Parte agente': formatarNumeroRelatorioNfp(item.valor_agente ?? item.valor_diego),
    'Parte AEB': formatarNumeroRelatorioNfp(item.valor_aeb),
    Final: formatarNumeroRelatorioNfp(item.final),
    Competência: item.competencia || '',
  }));
}

/** Linhas numéricas para XLSX com fórmulas de total. */
export function montarExportacaoRateioDetalhadoXlsx(relatorio) {
  return (relatorio?.linhas || []).map((item) => ({
    CNPJ: item.cnpj || '',
    Loja: item.loja || '',
    Captador: item.captador || '',
    Origem: rotuloOrigemRateio(item.origem),
    Fonte: item.fonte || '',
    'Número nota': item.numero_nota || '',
    Qtd: item.qtd ?? 0,
    Retorno: numeroExportacao(item.retorno),
    'Retorno loja': numeroExportacao(item.retorno_loja ?? item.retorno),
    'Retorno CPF': numeroExportacao(item.retorno_cpf ?? 0),
    'Parte agente': numeroExportacao(item.valor_agente ?? item.valor_diego),
    'Parte AEB': numeroExportacao(item.valor_aeb),
    Final: numeroExportacao(item.final),
    Competência: item.competencia || '',
  }));
}

export function montarBlocoTotaisRateioDetalhadoXlsx({
  colunas,
  primeiraLinhaDados,
  ultimaLinhaDados,
  totais = {},
  rotuloParte = 'Parte agentes',
  rotuloDoador = 'Doador AEB em lojas agentes',
  nomeColunaFn,
}) {
  if (!primeiraLinhaDados || !ultimaLinhaDados || !nomeColunaFn) return [];

  const idx = (nome) => colunas.indexOf(nome);
  const col = (nome) => nomeColunaFn(idx(nome));
  const r1 = primeiraLinhaDados;
  const r2 = ultimaLinhaDados;
  const cRet = col('Retorno');
  const cLoja = col('Retorno loja');
  const cCpf = col('Retorno CPF');
  const cFonte = col('Fonte');
  const cParteAg = col('Parte agente');
  const cParteAeb = col('Parte AEB');

  const formula = (expr, value) => ({ formula: expr, value: numeroExportacao(value) });

  return [
    {
      label: 'Bruto Lojas/CPFs',
      celula: formula(
        `SUM(${cLoja}${r1}:${cLoja}${r2})+SUM(${cCpf}${r1}:${cCpf}${r2})`,
        totais.bruto_lojas_cpfs_agente,
      ),
    },
    {
      label: 'Bruto Lojas',
      celula: formula(`SUM(${cLoja}${r1}:${cLoja}${r2})`, totais.bruto_lojas_somente),
    },
    {
      label: 'Bruto CPF',
      celula: formula(`SUM(${cCpf}${r1}:${cCpf}${r2})`, totais.bruto_cpf_agente),
    },
    {
      label: rotuloDoador,
      celula: formula(
        `SUMIF(${cFonte}${r1}:${cFonte}${r2},"Doador AEB",${cRet}${r1}:${cRet}${r2})`,
        totais.doador_aeb_loja_agente,
      ),
    },
    {
      label: rotuloParte,
      celula: formula(`SUM(${cParteAg}${r1}:${cParteAg}${r2})`, totais.parte_agente),
    },
    {
      label: 'Parte AEB',
      celula: formula(
        `SUMIF(${cFonte}${r1}:${cFonte}${r2},"Loja",${cParteAeb}${r1}:${cParteAeb}${r2})`
        + `+SUMIF(${cFonte}${r1}:${cFonte}${r2},"CPF",${cParteAeb}${r1}:${cParteAeb}${r2})`
        + `+SUMIF(${cFonte}${r1}:${cFonte}${r2},"Misto",${cParteAeb}${r1}:${cParteAeb}${r2})`
        + `+SUMIF(${cFonte}${r1}:${cFonte}${r2},"Doador AEB",${cRet}${r1}:${cRet}${r2})`,
        totais.parte_aeb_consolidada_agente ?? totais.parte_aeb,
      ),
    },
  ];
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
  'Modelo',
  'Série',
  'Número',
  'Valor',
  'Emissão',
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
    Modelo: item.modelo || '',
    Série: item.serie || '',
    Número: item.numero_nf || '',
    Valor: formatarValorCentavosCupom(item.valor_centavos),
    Emissão: item.data_emissao || '',
    'Emissão (ref.)': item.data_emissao_ref || '',
    'Lido em': item.lido_em || '',
    'Enviado em': item.enviado_em || '',
    Mensagem: item.mensagem || '',
  }));
}

export function formatarValorCentavosCupom(centavos) {
  if (centavos == null || centavos === '') return '';
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
