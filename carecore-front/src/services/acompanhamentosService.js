import api from './api';

const BASE = '/api/acompanhamentos';

export async function listarAcompanhamentos(endpoint, params = {}) {
  const { data } = await api.get(`${BASE}/${endpoint}`, { params });
  return data;
}

export async function criarAcompanhamento(endpoint, payload) {
  const { data } = await api.post(`${BASE}/${endpoint}`, payload);
  return data;
}

export async function atualizarAcompanhamento(endpoint, id, payload) {
  const { data } = await api.patch(`${BASE}/${endpoint}/${id}`, payload);
  return data;
}

export async function excluirAcompanhamento(endpoint, id) {
  await api.delete(`${BASE}/${endpoint}/${id}`);
}

export async function listarDestinosTransferencia() {
  const { data } = await api.get(`${BASE}/transferencias/opcoes`);
  return data?.destinos || [];
}

export async function obterResumoMensalAcompanhamentos({ mesReferencia, dataInicio, dataFim }) {
  const params = { mes_referencia: mesReferencia };
  if (dataInicio) params.data_inicio = dataInicio;
  if (dataFim) params.data_fim = dataFim;
  const { data } = await api.get(`${BASE}/resumo-mensal`, { params });
  return data;
}

export async function listarAcompanhamentosPorConvivente(conviventeId, params = {}) {
  const { data } = await api.get(`${BASE}/por-convivente/${conviventeId}`, { params });
  return data;
}

export async function obterDiscussaoHospitalar(registroId) {
  const { data } = await api.get(`${BASE}/discussoes-hospitalares/${registroId}`);
  return data;
}

export async function criarEvolucaoDiscussaoHospitalar(registroId, payload) {
  const { data } = await api.post(`${BASE}/discussoes-hospitalares/${registroId}/evolucoes`, payload);
  return data;
}

export async function obterPot(registroId) {
  const { data } = await api.get(`${BASE}/pot/${registroId}`);
  return data;
}

export async function criarEvolucaoPot(registroId, payload) {
  const { data } = await api.post(`${BASE}/pot/${registroId}/evolucoes`, payload);
  return data;
}

export async function exportarPot(params = {}) {
  const { data } = await api.get(`${BASE}/pot/exportar`, { params });
  return data;
}
