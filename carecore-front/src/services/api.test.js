import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aplicarRequestIdCareCore,
  criarHeadersAutenticados,
  criarHeadersCareCore,
  gerarCareCoreRequestId,
} from '../utils/requestIdUtils.js';
import {
  registrarAtividadeSessao,
  sessaoExpiradaPorInatividade,
  SESSION_INACTIVITY_LIMIT_MS,
  STORAGE_TOKEN_KEY,
} from '../utils/sessionInatividadeUtils.js';

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new LocalStorageMock();

describe('api request id helpers', () => {
  it('gera identificador de rastreio', () => {
    const requestId = gerarCareCoreRequestId();

    assert.equal(typeof requestId, 'string');
    assert.ok(requestId.length >= 16);
  });

  it('adiciona X-CareCore-Request-Id quando ausente', () => {
    const headers = aplicarRequestIdCareCore({});

    assert.equal(typeof headers['X-CareCore-Request-Id'], 'string');
    assert.ok(headers['X-CareCore-Request-Id'].length >= 16);
  });

  it('preserva X-CareCore-Request-Id existente', () => {
    const headers = aplicarRequestIdCareCore({
      'X-CareCore-Request-Id': 'request-existente',
    });

    assert.equal(headers['X-CareCore-Request-Id'], 'request-existente');
  });

  it('cria nova cópia de headers com request id', () => {
    const origem = { Accept: 'application/json' };
    const headers = criarHeadersCareCore(origem);

    assert.equal(headers.Accept, 'application/json');
    assert.equal(origem['X-CareCore-Request-Id'], undefined);
    assert.equal(typeof headers['X-CareCore-Request-Id'], 'string');
  });

  it('cria headers autenticados com request id', () => {
    const headers = criarHeadersAutenticados('token-teste');

    assert.equal(headers.Authorization, 'Bearer token-teste');
    assert.equal(typeof headers['X-CareCore-Request-Id'], 'string');
  });
});

describe('api session inactivity helpers', () => {
  it('mantém sessão ativa abaixo de 40 minutos de inatividade', () => {
    const dateNowOriginal = Date.now;

    try {
      Date.now = () => 100000;
      localStorage.setItem(STORAGE_TOKEN_KEY, 'token-teste');
      registrarAtividadeSessao();

      Date.now = () => 100000 + SESSION_INACTIVITY_LIMIT_MS - 1000;

      assert.equal(sessaoExpiradaPorInatividade(), false);
    } finally {
      Date.now = dateNowOriginal;
      localStorage.clear();
    }
  });

  it('expira sessão acima de 40 minutos de inatividade', () => {
    const dateNowOriginal = Date.now;

    try {
      Date.now = () => 100000;
      localStorage.setItem(STORAGE_TOKEN_KEY, 'token-teste');
      registrarAtividadeSessao();

      Date.now = () => 100000 + SESSION_INACTIVITY_LIMIT_MS + 1000;

      assert.equal(sessaoExpiradaPorInatividade(), true);
    } finally {
      Date.now = dateNowOriginal;
      localStorage.clear();
    }
  });
});
