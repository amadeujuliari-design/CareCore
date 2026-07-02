import api from './api';

export async function obterPainelAjustesTotaisDia(data) {
  const response = await api.get('/api/rotina/ajustes-totais/dia', {
    params: { data },
  });
  return response.data;
}

export async function salvarAjustesTotaisDia(payload) {
  const response = await api.post('/api/rotina/ajustes-totais/dia', payload);
  return response.data;
}
