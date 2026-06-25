import api from './api';

export async function buscarRelatorioPresencaPeriodo({
  dataInicio,
  dataFim,
  tecnicoId,
  busca,
  statusConvivente,
  filtroSituacao,
}) {
  const response = await api.get('/api/relatorios/presenca-periodo', {
    params: {
      data_inicio: dataInicio,
      data_fim: dataFim,
      tecnico_id: tecnicoId || undefined,
      busca: (busca || '').trim() || undefined,
      status_convivente: statusConvivente || 'todos',
      filtro_situacao: filtroSituacao || 'presenca_ou_justificada',
    },
  });
  return response.data;
}
