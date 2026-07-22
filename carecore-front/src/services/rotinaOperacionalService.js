import api from './api';
import { buscarTodosItensPaginados } from '../utils/buscarTodosPaginados';
import { REGISTROS_POR_PAGINA_PRONTUARIO } from '../utils/prontuarioHistoricoFluxoUtils';

const LISTA_VAZIA = {
  items: [],
  total: 0,
  limit: REGISTROS_POR_PAGINA_PRONTUARIO,
  offset: 0,
  has_more: false,
  resumo_fila: null,
};

export async function listarLavanderia(statusFiltro = 'pendentes', params = {}) {
  const response = await api.get('/api/rotina/lavanderia', {
    params: {
      status_filtro: statusFiltro,
      limite: params.limite ?? REGISTROS_POR_PAGINA_PRONTUARIO,
      offset: params.offset ?? 0,
      ...(params.data_inicio ? { data_inicio: params.data_inicio } : {}),
      ...(params.data_fim ? { data_fim: params.data_fim } : {}),
      ...(params.busca ? { busca: params.busca } : {}),
    },
  });
  return response.data || LISTA_VAZIA;
}

export async function listarLavanderiaCompleta(statusFiltro = 'pendentes', params = {}) {
  return buscarTodosItensPaginados({
    limitePagina: 100,
    buscarPagina: ({ limite, offset }) => listarLavanderia(statusFiltro, { ...params, limite, offset }),
  });
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

export async function listarPertencesRecolhidos(statusFiltro = 'abertos', params = {}) {
  const response = await api.get('/api/rotina/pertences-recolhidos', {
    params: {
      status_filtro: statusFiltro,
      limite: params.limite ?? REGISTROS_POR_PAGINA_PRONTUARIO,
      offset: params.offset ?? 0,
      ...(params.data_inicio ? { data_inicio: params.data_inicio } : {}),
      ...(params.data_fim ? { data_fim: params.data_fim } : {}),
      ...(params.busca ? { busca: params.busca } : {}),
    },
  });
  return response.data || LISTA_VAZIA;
}

export async function listarPertencesRecolhidosCompleto(statusFiltro = 'abertos', params = {}) {
  return buscarTodosItensPaginados({
    limitePagina: 100,
    buscarPagina: ({ limite, offset }) => listarPertencesRecolhidos(statusFiltro, { ...params, limite, offset }),
  });
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

export async function baixarPertencesRecolhidosAdministrativoLote(payload) {
  const response = await api.post(
    '/api/rotina/pertences-recolhidos/baixa-administrativa-lote',
    payload,
  );
  return response.data;
}
