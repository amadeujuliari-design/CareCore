import axios from "axios";

import { API_ROOT } from "../config/apiBase";
import { buscarTodosItensPaginados } from "../utils/buscarTodosPaginados";
import { criarHeadersAutenticados } from "../utils/requestIdUtils";

function authHeaders(token) {
  const tokenFinal = token || localStorage.getItem("@CareCore:token");

  if (!tokenFinal) {
    throw new Error("Token de autenticação não encontrado.");
  }

  return criarHeadersAutenticados(tokenFinal);
}

function normalizarListaPaginada(data, limite, offset) {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      limit: limite,
      offset,
      has_more: false,
    };
  }

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total || 0),
    limit: Number(data?.limit || limite),
    offset: Number(data?.offset || offset),
    has_more: Boolean(data?.has_more),
  };
}

export async function listarMeusAvisos(token, opcoes = {}) {
  const limite = Number(opcoes.limite || 10);
  const offset = Number(opcoes.offset || 0);
  const somenteNaoLidos = Boolean(opcoes.somenteNaoLidos);

  const response = await axios.get(`${API_ROOT}/avisos/me`, {
    headers: authHeaders(token),
    params: {
      limite,
      offset,
      somente_nao_lidos: somenteNaoLidos,
      busca: opcoes.busca || undefined,
      classificacao: opcoes.classificacao || undefined,
      prioridade: opcoes.prioridade || undefined,
      data_inicio: opcoes.data_inicio || undefined,
      data_fim: opcoes.data_fim || undefined,
    },
  });

  return normalizarListaPaginada(response.data, limite, offset);
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

export async function listarHistoricoAvisos(token, filtros = {}) {
  const limite = Number(filtros.limite || 10);
  const offset = Number(filtros.offset || 0);

  const response = await axios.get(`${API_ROOT}/avisos/historico`, {
    headers: authHeaders(token),
    params: {
      status_filtro: filtros.status_filtro || "baixados",
      busca: filtros.busca || undefined,
      classificacao: filtros.classificacao || undefined,
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      limite,
      offset,
    },
  });

  return normalizarListaPaginada(response.data, limite, offset);
}

export async function listarMeusAvisosCompleto(token, opcoes = {}) {
  return buscarTodosItensPaginados({
    limitePagina: 100,
    buscarPagina: ({ limite, offset }) => listarMeusAvisos(token, { ...opcoes, limite, offset }),
  });
}

export async function listarHistoricoAvisosCompleto(token, filtros = {}) {
  return buscarTodosItensPaginados({
    limitePagina: 100,
    buscarPagina: ({ limite, offset }) => listarHistoricoAvisos(token, { ...filtros, limite, offset }),
  });
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
