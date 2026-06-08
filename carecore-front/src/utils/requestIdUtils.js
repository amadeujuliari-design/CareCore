export function gerarCareCoreRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `carecore-${Date.now().toString(36)}-${aleatorio}`;
}

export function aplicarRequestIdCareCore(headers = {}) {
  if (!headers['X-CareCore-Request-Id']) {
    headers['X-CareCore-Request-Id'] = gerarCareCoreRequestId();
  }

  return headers;
}

export function criarHeadersCareCore(headers = {}) {
  return aplicarRequestIdCareCore({ ...headers });
}

export function criarHeadersAutenticados(token, headers = {}) {
  const headersCareCore = criarHeadersCareCore(headers);

  if (token) {
    headersCareCore.Authorization = `Bearer ${token}`;
  }

  return headersCareCore;
}
