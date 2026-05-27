/** Origem da API FastAPI (sem barra final). Sobrescreva com VITE_API_BASE_URL no .env */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export const API_ROOT = `${API_BASE_URL}/api`;

