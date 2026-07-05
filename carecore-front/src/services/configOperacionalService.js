import api from './api';

export async function buscarConfigOperacional() {
  const { data } = await api.get('/api/organizacao/config-operacional');
  return data;
}

export async function salvarConfigOperacional(payload) {
  const { data } = await api.put('/api/organizacao/config-operacional', payload);
  return data;
}
