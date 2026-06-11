import api from './api';

async function listarPasskeys() {
  const response = await api.get('/api/passkeys/me');
  return response.data || [];
}

async function criarOpcoesRegistroPasskey() {
  const response = await api.post('/api/passkeys/registro/options');
  return response.data;
}

async function verificarRegistroPasskey(payload) {
  const response = await api.post('/api/passkeys/registro/verify', payload);
  return response.data;
}

async function criarOpcoesLoginPasskey(email) {
  const response = await api.post('/api/passkeys/login/options', { email });
  return response.data;
}

async function verificarLoginPasskey(payload) {
  const response = await api.post('/api/passkeys/login/verify', payload);
  return response.data;
}

async function removerPasskey(passkeyId) {
  const response = await api.delete(`/api/passkeys/${passkeyId}`);
  return response.data;
}

export {
  criarOpcoesLoginPasskey,
  criarOpcoesRegistroPasskey,
  listarPasskeys,
  removerPasskey,
  verificarLoginPasskey,
  verificarRegistroPasskey,
};
