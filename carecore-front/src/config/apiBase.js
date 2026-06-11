/** Origem da API FastAPI (sem barra final). Sobrescreva com VITE_API_BASE_URL no .env */
const API_PRODUCAO_PADRAO = 'https://carecoreplus-api.fly.dev';

const apiBasePadrao = () => {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000';
  }

  const hostLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!hostLocal) {
    return API_PRODUCAO_PADRAO;
  }

  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? apiBasePadrao()
).replace(/\/$/, '');

export const API_ROOT = `${API_BASE_URL}/api`;

