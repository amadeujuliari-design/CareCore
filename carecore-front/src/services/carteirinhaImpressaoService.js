import axios from 'axios';
import { API_ROOT } from '../config/apiBase';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';

export async function listarLogImpressoesCarteirinha(token, params = {}) {
  const response = await axios.get(`${API_ROOT}/carteirinha/impressoes-log`, {
    headers: criarHeadersAutenticados(token),
    params,
  });
  return response.data;
}
