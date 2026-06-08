import api from './api';

export async function listarLavanderia(statusFiltro = 'pendentes') {
  const response = await api.get('/api/rotina/lavanderia', {
    params: { status_filtro: statusFiltro },
  });
  return response.data || [];
}

export async function registrarLavanderia(payload) {
  const response = await api.post('/api/rotina/lavanderia', payload);
  return response.data;
}

export async function retirarLavanderia(registroId, payload) {
  const response = await api.patch(`/api/rotina/lavanderia/${registroId}/retirar`, payload);
  return response.data;
}

export async function cancelarLavanderia(registroId, payload) {
  const response = await api.patch(`/api/rotina/lavanderia/${registroId}/cancelar`, payload);
  return response.data;
}

export async function listarPertencesRecolhidos(statusFiltro = 'abertos') {
  const response = await api.get('/api/rotina/pertences-recolhidos', {
    params: { status_filtro: statusFiltro },
  });
  return response.data || [];
}

export async function registrarPertencesRecolhidos(payload) {
  const response = await api.post('/api/rotina/pertences-recolhidos', payload);
  return response.data;
}

export async function retirarPertencesRecolhidos(registroId, payload) {
  const response = await api.patch(`/api/rotina/pertences-recolhidos/${registroId}/retirar`, payload);
  return response.data;
}

export async function baixarPertencesRecolhidosAdministrativo(registroId, payload) {
  const response = await api.patch(
    `/api/rotina/pertences-recolhidos/${registroId}/baixa-administrativa`,
    payload,
  );
  return response.data;
}
