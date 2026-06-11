import axios from 'axios';

import { API_ROOT } from '../config/apiBase';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';

function authHeaders(token) {
  const tokenFinal = token || localStorage.getItem('@CareCore:token');

  if (!tokenFinal) {
    throw new Error('Token de autenticação não encontrado.');
  }

  return criarHeadersAutenticados(tokenFinal);
}

export async function criarChamadoSuporte(token, payload) {
  const response = await axios.post(`${API_ROOT}/suporte/chamados`, payload, {
    headers: authHeaders(token),
  });

  return response.data;
}

export async function listarChamadosSuporte(token, filtros = {}) {
  const response = await axios.get(`${API_ROOT}/suporte/chamados`, {
    headers: authHeaders(token),
    params: {
      busca: filtros.busca || undefined,
      status_filtro: filtros.status_filtro || undefined,
      escopo: filtros.escopo || 'meus',
      limit: filtros.limit || 20,
      offset: filtros.offset || 0,
    },
  });

  return {
    items: Array.isArray(response.data?.items) ? response.data.items : [],
    total: Number(response.data?.total || 0),
    limit: Number(response.data?.limit || filtros.limit || 20),
    offset: Number(response.data?.offset || filtros.offset || 0),
    has_more: Boolean(response.data?.has_more),
  };
}

export async function obterChamadoSuporte(token, chamadoId) {
  const response = await axios.get(`${API_ROOT}/suporte/chamados/${chamadoId}`, {
    headers: authHeaders(token),
  });

  return response.data;
}

export async function responderChamadoSuporte(token, chamadoId, mensagem) {
  const response = await axios.post(
    `${API_ROOT}/suporte/chamados/${chamadoId}/mensagens`,
    { mensagem },
    { headers: authHeaders(token) },
  );

  return response.data;
}

export async function atualizarStatusChamadoSuporte(token, chamadoId, status) {
  const response = await axios.patch(
    `${API_ROOT}/suporte/chamados/${chamadoId}/status`,
    { status },
    { headers: authHeaders(token) },
  );

  return response.data;
}
