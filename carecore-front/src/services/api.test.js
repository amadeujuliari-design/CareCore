import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aplicarRequestIdCareCore,
  criarHeadersAutenticados,
  criarHeadersCareCore,
  gerarCareCoreRequestId,
} from '../utils/requestIdUtils.js';

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
