const STORAGE_TOKEN_KEY = '@CareCore:token';
const STORAGE_USER_KEY = '@CareCore:user';
const STORAGE_LAST_ACTIVITY_KEY = '@CareCore:lastActivityAt';
const SESSION_INACTIVITY_LIMIT_MS = 40 * 60 * 1000;

function obterAgoraSessao() {
  return Date.now();
}

function obterTokenLocal() {
  return (
    localStorage.getItem(STORAGE_TOKEN_KEY) ||
    localStorage.getItem('token')
  );
}

function obterUltimaAtividadeSessao() {
  const valor = Number(localStorage.getItem(STORAGE_LAST_ACTIVITY_KEY));

  return Number.isFinite(valor) ? valor : null;
}

function registrarAtividadeSessao() {
  if (!obterTokenLocal()) {
    return;
  }

  localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(obterAgoraSessao()));
}

function sessaoExpiradaPorInatividade() {
  if (!obterTokenLocal()) {
    return false;
  }

  const ultimaAtividade = obterUltimaAtividadeSessao();

  if (!ultimaAtividade) {
    registrarAtividadeSessao();
    return false;
  }

  return obterAgoraSessao() - ultimaAtividade > SESSION_INACTIVITY_LIMIT_MS;
}

export {
  obterTokenLocal,
  registrarAtividadeSessao,
  sessaoExpiradaPorInatividade,
  SESSION_INACTIVITY_LIMIT_MS,
  STORAGE_LAST_ACTIVITY_KEY,
  STORAGE_TOKEN_KEY,
  STORAGE_USER_KEY,
};
