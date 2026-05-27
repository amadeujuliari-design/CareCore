// =====================================================================
// ARQUIVO: src/services/avisosService.js
// Serviço de comunicação interna / avisos importantes CARECORE+
// =====================================================================
import axios from "axios";

import { API_ROOT } from "../config/apiBase";

function authHeaders(token) {
  const tokenFinal = token || localStorage.getItem("@CareCore:token");

  if (!tokenFinal) {
    throw new Error("Token de autenticação não encontrado.");
  }

  return {
    Authorization: `Bearer ${tokenFinal}`,
  };
}

export async function listarMeusAvisos(token, opcoes = {}) {
  const limite = Number(opcoes.limite || 10);
  const somenteNaoLidos = Boolean(opcoes.somenteNaoLidos);

  const response = await axios.get(`${API_ROOT}/avisos/me`, {
    headers: authHeaders(token),
    params: {
      limite,
      somente_nao_lidos: somenteNaoLidos,
    },
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function obterResumoAvisos(token) {
  const response = await axios.get(`${API_ROOT}/avisos/me/resumo`, {
    headers: authHeaders(token),
  });

  return {
    total_visiveis: Number(response.data?.total_visiveis || 0),
    total_nao_lidos: Number(response.data?.total_nao_lidos || 0),
    total_alertas_ativos: Number(response.data?.total_alertas_ativos || 0),
  };
}

export async function marcarAvisoComoLido(token, avisoId) {
  if (!avisoId) {
    throw new Error("ID do aviso não informado.");
  }

  const response = await axios.patch(
    `${API_ROOT}/avisos/${avisoId}/lido`,
    {},
    { headers: authHeaders(token) }
  );

  return response.data;
}

export async function criarAviso(token, payload) {
  const response = await axios.post(`${API_ROOT}/avisos`, payload, {
    headers: authHeaders(token),
  });

  return response.data;
}

export async function atualizarAviso(token, avisoId, payload) {
  if (!avisoId) {
    throw new Error("ID do aviso não informado.");
  }

  const response = await axios.patch(`${API_ROOT}/avisos/${avisoId}`, payload, {
    headers: authHeaders(token),
  });

  return response.data;
}

export async function cancelarAviso(token, avisoId) {
  if (!avisoId) {
    throw new Error("ID do aviso não informado.");
  }

  const response = await axios.delete(`${API_ROOT}/avisos/${avisoId}`, {
    headers: authHeaders(token),
  });

  return response.data;
}
