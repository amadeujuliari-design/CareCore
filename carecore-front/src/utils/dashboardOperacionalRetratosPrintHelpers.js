export const COLUNAS_RETRATOS_DASHBOARD = [
  'Data',
  'Capturado em',
  'Dentro',
  'Fora',
  'Interações',
  'Registros',
  'Ajuste manual',
];

export function formatarDataBrRetrato(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

export function formatarDataHoraBrRetrato(iso) {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return String(iso);
  return data.toLocaleString('pt-BR');
}

export function montarDadosRetratosDashboard(itens = []) {
  return [...itens]
    .sort((a, b) => String(a.data_referencia || '').localeCompare(String(b.data_referencia || '')))
    .map((item) => {
      const ajuste = item?.ajustes_manuais?.tem_ajuste
        ? `+${item.ajustes_manuais.total_complemento || 0}`
        : '—';
      return {
        Data: formatarDataBrRetrato(item.data_referencia),
        'Capturado em': formatarDataHoraBrRetrato(item.capturado_em),
        Dentro: Number(item?.resumo?.dentro_projeto || 0),
        Fora: Number(item?.resumo?.fora_projeto || 0),
        Interações: Number(item?.resumo?.total_interacoes_hoje || 0),
        Registros: Number(item?.resumo?.total_registros_hoje || 0),
        'Ajuste manual': ajuste,
      };
    });
}

export function montarMetricasRetratosDashboard(itens = []) {
  const dados = montarDadosRetratosDashboard(itens);
  const comAjuste = itens.filter((item) => item?.ajustes_manuais?.tem_ajuste).length;
  return [
    { label: 'Dias no período', valor: dados.length },
    { label: 'Com ajuste manual', valor: comAjuste },
    {
      label: 'Média dentro',
      valor: dados.length
        ? Math.round(dados.reduce((acc, row) => acc + Number(row.Dentro || 0), 0) / dados.length)
        : 0,
    },
    {
      label: 'Média fora',
      valor: dados.length
        ? Math.round(dados.reduce((acc, row) => acc + Number(row.Fora || 0), 0) / dados.length)
        : 0,
    },
  ];
}
