import axios from 'axios';

import { API_BASE_URL } from '../config/apiBase';
import { limparFotoCache } from '../utils/fotoCache';
import {
  aplicarRequestIdCareCore,
  gerarCareCoreRequestId,
} from '../utils/requestIdUtils';
import {
  obterTokenLocal,
  registrarAtividadeSessao,
  sessaoExpiradaPorInatividade,
  SESSION_INACTIVITY_LIMIT_MS,
  STORAGE_LAST_ACTIVITY_KEY,
  STORAGE_TOKEN_KEY,
  STORAGE_USER_KEY,
} from '../utils/sessionInatividadeUtils';

const api = axios.create({
  baseURL: API_BASE_URL,
});

function limparSessaoLocal() {
  limparFotoCache();

  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_LAST_ACTIVITY_KEY);

  // Compatibilidade com entregas anteriores da Fase 1A.
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

function salvarSessaoLocal(token, usuario) {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(usuario));
  registrarAtividadeSessao();

  // Compatibilidade com entregas anteriores da Fase 1A.
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function redirecionarLoginSeNecessario() {
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

api.interceptors.request.use(
  (config) => {
    const token = obterTokenLocal();
    config.headers = aplicarRequestIdCareCore(config.headers || {});

    if (token && sessaoExpiradaPorInatividade()) {
      limparSessaoLocal();
      redirecionarLoginSeNecessario();

      return Promise.reject(
        new Error('Sessão expirada por inatividade. Faça login novamente.')
      );
    }

    if (token) {
      registrarAtividadeSessao();
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
      redirecionarLoginSeNecessario();
    }

    return Promise.reject(error);
  }
);

export {
  aplicarRequestIdCareCore,
  gerarCareCoreRequestId,
  limparSessaoLocal,
  obterTokenLocal,
  registrarAtividadeSessao,
  salvarSessaoLocal,
  sessaoExpiradaPorInatividade,
  SESSION_INACTIVITY_LIMIT_MS,
};
export default api;