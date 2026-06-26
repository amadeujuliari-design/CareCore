import axios from 'axios';

import { API_ROOT } from '../config/apiBase';
import { buscarTodosItensPaginados } from '../utils/buscarTodosPaginados';
import { montarParamsFiltrosRotina } from '../utils/rotinaHistoricoUtils';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';

export const EXPORT_ROTINA_HISTORICO_LIMITE_MAX = 5000;

export async function buscarHistoricoRotinaCompleto(token, filtros) {
  return buscarTodosItensPaginados({
    limitePagina: EXPORT_ROTINA_HISTORICO_LIMITE_MAX,
    maxRegistros: EXPORT_ROTINA_HISTORICO_LIMITE_MAX,
    buscarPagina: async ({ limite, offset }) => {
      const response = await axios.get(`${API_ROOT}/rotina/historico`, {
        params: {
          ...montarParamsFiltrosRotina(filtros),
          limite,
          deslocamento: offset,
        },
        headers: criarHeadersAutenticados(token),
      });

      const payload = response.data;
      if (Array.isArray(payload)) {
        return { registros: payload, total: payload.length };
      }

      const registros = payload?.registros || [];
      return {
        registros,
        total: payload?.total ?? registros.length,
      };
    },
  });
}
