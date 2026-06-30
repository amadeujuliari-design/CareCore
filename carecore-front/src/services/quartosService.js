import api from './api';
import { ordenarQuartosComLeitos } from '../utils/ordenacaoNatural';

export async function listarQuartosOrdenados() {
  const response = await api.get('/api/quartos');
  return ordenarQuartosComLeitos(response.data || []);
}
