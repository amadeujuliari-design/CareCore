import api from './api';

export async function buscarRelatorioCadastrosNovos({
  dataInicio,
  dataFim,
  criterio,
  statusFiltro,
  tecnicoId,
  busca,
}) {
  const response = await api.get('/api/relatorios/cadastros-novos', {
    params: {
      data_inicio: dataInicio,
      data_fim: dataFim,
      criterio: criterio || 'inclusoes',
      status: (statusFiltro || []).length ? statusFiltro.join(',') : undefined,
      tecnico_id: tecnicoId || undefined,
      busca: (busca || '').trim() || undefined,
    },
  });
  return response.data;
}
