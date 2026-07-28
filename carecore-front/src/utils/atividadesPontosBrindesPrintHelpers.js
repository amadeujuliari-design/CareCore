export const COLUNAS_RANKING_PONTOS_BRINDES = [
  '#',
  'Convivente',
  'Prontuário',
  'Presenças',
  'Ganhos',
  'Usados',
  'Saldo',
];

export function filtrarItensComSaldoPontos(itens = []) {
  return (itens || []).filter((item) => Number(item?.saldo_pontos || 0) > 0);
}

export function resolverItensRelatorioPontosBrindes({
  ranking = [],
  selecionado = null,
} = {}) {
  if (selecionado?.convivente_id) {
    const noRanking = ranking.find(
      (item) => item.convivente_id === selecionado.convivente_id,
    );
    return {
      itens: [noRanking || selecionado],
      escopo: 'selecionado',
      rotuloEscopo: `Convivente selecionado: ${selecionado.nome || '—'}`,
    };
  }

  const comSaldo = filtrarItensComSaldoPontos(ranking);
  return {
    itens: comSaldo,
    escopo: 'com_saldo',
    rotuloEscopo: 'Todos com saldo de pontos',
  };
}

export function montarDadosExportacaoRankingPontos(itens = []) {
  return (itens || []).map((item, indice) => ({
    '#': item.posicao ?? indice + 1,
    Convivente: item.nome || '',
    Prontuário: item.numero_institucional ?? '',
    Presenças: item.total_presencas ?? 0,
    Ganhos: item.pontos_ganhos ?? 0,
    Usados: item.pontos_utilizados ?? 0,
    Saldo: item.saldo_pontos ?? 0,
  }));
}

export function montarMetricasRankingPontos(itens = []) {
  const lista = itens || [];
  const totalSaldo = lista.reduce((acc, item) => acc + Number(item.saldo_pontos || 0), 0);
  const totalGanhos = lista.reduce((acc, item) => acc + Number(item.pontos_ganhos || 0), 0);
  const totalUsados = lista.reduce((acc, item) => acc + Number(item.pontos_utilizados || 0), 0);
  return [
    { label: 'Conviventes', valor: lista.length },
    { label: 'Pontos ganhos', valor: totalGanhos },
    { label: 'Pontos usados', valor: totalUsados },
    { label: 'Saldo total', valor: totalSaldo },
  ];
}
