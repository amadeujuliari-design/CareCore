export function formatarDataBr(valor) {
  if (!valor) return '-';
  const texto = String(valor).slice(0, 10);
  const partes = texto.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return texto;
}

export function formatarEvolucoesTexto(evolucoes = []) {
  if (!evolucoes.length) return 'Sem evoluções';
  return evolucoes
    .map((evo) => {
      const data = formatarDataBr(evo.data_evolucao);
      const status = evo.status_evolucao || '-';
      const obs = (evo.observacoes || '').trim();
      return obs ? `${data} · ${status} — ${obs}` : `${data} · ${status}`;
    })
    .join(' | ');
}

export function montarItensRodapeIdentidade(identidadeRelatorio = null) {
  return [
    identidadeRelatorio?.relatorio_rodape_linha1,
    identidadeRelatorio?.relatorio_rodape_linha2,
    identidadeRelatorio?.relatorio_telefone
      ? `Telefone: ${identidadeRelatorio.relatorio_telefone}`
      : '',
    identidadeRelatorio?.relatorio_email
      ? `E-mail: ${identidadeRelatorio.relatorio_email}`
      : '',
    identidadeRelatorio?.relatorio_site
      ? `Site: ${identidadeRelatorio.relatorio_site}`
      : '',
  ].filter(Boolean);
}

export function montarFiltrosRotuloPot({
  busca = '',
  dataInicio = '',
  dataFim = '',
  filtrosExtras = {},
  total = 0,
  incluirEvolucoes = null,
  tecnicoRotulo = '',
} = {}) {
  const filtros = {};
  if (busca?.trim()) filtros.Busca = busca.trim();
  if (dataInicio || dataFim) {
    filtros['Período inserção'] = [
      dataInicio ? formatarDataBr(dataInicio) : '…',
      dataFim ? formatarDataBr(dataFim) : '…',
    ].join(' a ');
  }
  if (filtrosExtras.status_convivente) {
    filtros['Status convivente'] = filtrosExtras.status_convivente;
  } else {
    filtros['Status convivente'] = 'Todos';
  }
  if (filtrosExtras.local) filtros.Local = filtrosExtras.local;
  if (tecnicoRotulo) filtros['Técnico'] = tecnicoRotulo;
  if (filtrosExtras.situacao_atual) filtros['Situação POT'] = filtrosExtras.situacao_atual;
  if (incluirEvolucoes != null) {
    filtros.Detalhes = incluirEvolucoes ? 'Com evoluções' : 'Sem evoluções';
  }
  filtros['Total filtrado'] = total;
  return filtros;
}
