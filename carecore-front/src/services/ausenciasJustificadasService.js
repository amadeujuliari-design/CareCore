import api from './api';

export async function listarAusenciasJustificadasPendentes() {
  const response = await api.get('/api/ausencias-justificadas/pendencias');
  return response.data || [];
}

export async function responderAusenciaJustificada(conviventeId, payload) {
  const response = await api.post(`/api/ausencias-justificadas/${conviventeId}/responder`, payload);
  return response.data;
}
