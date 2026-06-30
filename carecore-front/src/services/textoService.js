import axios from 'axios';
import { API_ROOT } from '../config/apiBase';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';

export async function obterStatusRevisaoTexto(token) {
  const response = await axios.get(`${API_ROOT}/texto/revisar/status`, {
    headers: criarHeadersAutenticados(token),
  });
  return response.data;
}

export async function revisarTexto(token, { titulo = '', texto = '', conviventeId = null, contexto = null }) {
  const response = await axios.post(
    `${API_ROOT}/texto/revisar`,
    {
      titulo,
      texto,
      convivente_id: conviventeId || null,
      contexto: contexto || null,
    },
    { headers: criarHeadersAutenticados(token) },
  );
  return response.data;
}
