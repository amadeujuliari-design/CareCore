import api from './api';

export async function buscarRelatorioPresencaLegado({
  dataInicio,
  dataFim,
  busca = '',
}) {
  const response = await api.get('/api/historico-legado/rotina/relatorio-presencas', {
    params: {
      data_inicio: dataInicio,
      data_fim: dataFim,
      busca: busca?.trim() || undefined,
    },
  });
  return response.data;
}
