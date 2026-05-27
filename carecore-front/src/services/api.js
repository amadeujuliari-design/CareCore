import axios from 'axios';

import { API_BASE_URL } from '../config/apiBase';

const api = axios.create({
  baseURL: API_BASE_URL,
});

function limparSessaoLocal() {
  localStorage.removeItem('@CareCore:token');
  localStorage.removeItem('@CareCore:user');

  // Compatibilidade com entregas anteriores da Fase 1A.
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

function obterTokenLocal() {
  return (
    localStorage.getItem('@CareCore:token') ||
    localStorage.getItem('token')
  );
}

api.interceptors.request.use(
  (config) => {
    const token = obterTokenLocal();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      limparSessaoLocal();

      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export { limparSessaoLocal, obterTokenLocal };
export default api;