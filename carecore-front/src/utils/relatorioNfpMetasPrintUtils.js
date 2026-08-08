/** Montagem de colunas/linhas/metricas para impressao de Metas NFP (sem DOM/print). */

export const OPCOES_IMPRESSAO_METAS_PADRAO = {
  incluirResumo: true,
  incluirPercentuais: true,
  incluirValoresRateio: true,
  incluirSoulcial: true,
  incluirDiego: true,
};

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function inteiro(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`;
}

export function mesRotuloMetas(aaaaMm) {
  if (!aaaaMm || String(aaaaMm).length < 7) return aaaaMm || '—';
  const [ano, mes] = String(aaaaMm).split('-');
  const nomes = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ];
  const idx = Number(mes) - 1;
  return `${nomes[idx] || mes}/${ano}`;
}

export function montarColunasMetasMensal(opcoes = OPCOES_IMPRESSAO_METAS_PADRAO) {
  const o = { ...OPCOES_IMPRESSAO_METAS_PADRAO, ...opcoes };
  const colunas = ['Projeto', 'Digitadas'];
  if (o.incluirPercentuais) colunas.push('% dig.');
  colunas.push('Doadas');
  if (o.incluirPercentuais) colunas.push('% doad.');
  if (o.incluirValoresRateio) {
    colunas.push('Vlr digitado', 'Vlr aplicativo', 'Vlr total');
  }
  if (o.incluirSoulcial) colunas.push('Soulcial', 'Campanhas');
  if (o.incluirDiego) colunas.push('Diego');
  colunas.push('Total');
  return colunas;
}

export function montarLinhasMetasMensal(dados, opcoes = OPCOES_IMPRESSAO_METAS_PADRAO) {
  const o = { ...OPCOES_IMPRESSAO_METAS_PADRAO, ...opcoes };
  return (dados?.linhas || []).map((l) => {
    const row = {
      Projeto: l.codigo_projeto,
      Digitadas: inteiro(l.digitadas),
      Doadas: inteiro(l.doadas),
      Total: money(l.total),
    };
    if (o.incluirPercentuais) {
      row['% dig.'] = pct(l.pct_digitadas);
      row['% doad.'] = pct(l.pct_doadas);
    }
    if (o.incluirValoresRateio) {
      row['Vlr digitado'] = money(l.valor_digitado);
      row['Vlr aplicativo'] = money(l.valor_aplicativo);
      row['Vlr total'] = money(l.valor_total);
    }
    if (o.incluirSoulcial) {
      row.Soulcial = money(l.soulcial);
      row.Campanhas = money(l.soulcial_campanhas);
    }
    if (o.incluirDiego) {
      row.Diego = money(l.diego);
    }
    return row;
  });
}

export function montarMetricasMetasMensal(dados, opcoes = OPCOES_IMPRESSAO_METAS_PADRAO) {
  const o = { ...OPCOES_IMPRESSAO_METAS_PADRAO, ...opcoes };
  if (!o.incluirResumo) return [];
  const head = dados?.cabecalho || {};
  const calc = dados?.calculado || {};
  return [
    { label: 'Digitadas (entrada)', valor: money(head.f35_digitado) },
    { label: 'Doadas CPF (entrada)', valor: money(head.f36_doado) },
    { label: 'Soulcial base', valor: money(head.soulcial_base) },
    { label: 'Total captador', valor: money(head.total_captador) },
    { label: 'P/ projetos (digitadas)', valor: money(calc.h35_projetos) },
    { label: 'P/ projetos (doadas)', valor: money(calc.h36_projetos) },
    { label: 'Valor Diego 50%', valor: money(calc.valor_diego) },
    { label: 'Valor conquistado', valor: money(calc.valor_conquistado ?? calc.total_geral_aeb) },
    { label: 'Valor aplicado', valor: money(calc.valor_aplicado) },
    {
      label: 'Batimento',
      valor: calc.batimento_ok
        ? 'Coincide'
        : `Divergente (${money(calc.batimento_diferenca)})`,
    },
    { label: 'Total rateio (projetos)', valor: money(calc.total_rateio_geral) },
    { label: 'Digitadas projetos', valor: inteiro(calc.digitadas_projetos) },
    { label: 'Digitadas geral', valor: inteiro(calc.digitadas_geral) },
  ];
}

export function montarColunasMetasConsolidado() {
  return ['#', 'Projeto', 'Digitadas', 'Doadas', 'Valor total', 'Total geral'];
}

export function montarLinhasMetasConsolidado(consolidado) {
  return (consolidado?.por_projeto || []).map((p) => ({
    '#': p.colocacao,
    Projeto: p.codigo_projeto,
    Digitadas: inteiro(p.digitadas),
    Doadas: inteiro(p.doadas),
    'Valor total': money(p.valor_total),
    'Total geral': money(p.total),
  }));
}
