import axios from 'axios';

import { API_BASE_URL } from '../config/apiBase';
import { limparFotoCache } from '../utils/fotoCache';
import {
  aplicarRequestIdCareCore,
  gerarCareCoreRequestId,
} from '../utils/requestIdUtils';

const api = axios.create({
  baseURL: API_BASE_URL,
});

function limparSessaoLocal() {
  limparFotoCache();

  localStorage.removeItem('@CareCore:token');
  localStorage.removeItem('@CareCore:user');

  // Compatibilidade com entregas anteriores da Fase 1A.
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

function salvarSessaoLocal(token, usuario) {
  localStorage.setItem('@CareCore:token', token);
  localStorage.setItem('@CareCore:user', JSON.stringify(usuario));

  // Compatibilidade com entregas anteriores da Fase 1A.
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
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
    config.headers = aplicarRequestIdCareCore(config.headers || {});

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

export {
  aplicarRequestIdCareCore,
  gerarCareCoreRequestId,
  limparSessaoLocal,
  obterTokenLocal,
  salvarSessaoLocal,
};
export default api;