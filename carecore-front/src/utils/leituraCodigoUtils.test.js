import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JANELA_IGNORAR_LEITURA_REPETIDA_MS,
  deveIgnorarLeituraCodigoRepetida,
  deveIgnorarLeituraConviventeRepetida,
} from './leituraCodigoUtils.js';

describe('leituraCodigoUtils', () => {
  it('ignora o mesmo codigo dentro da janela de 7 segundos', () => {
    const ref = { current: { codigo: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, ' 123 '), false);
    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '123'), true);
  });

  it('permite codigo diferente na sequencia dentro da janela', () => {
    const ref = { current: { codigo: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '111'), false);
    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '222'), false);
  });

  it('libera o mesmo codigo apos a janela expirar', () => {
    const ref = {
      current: {
        codigo: '999',
        horario: Date.now() - JANELA_IGNORAR_LEITURA_REPETIDA_MS - 1,
      },
    };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '999'), false);
  });

  it('ignora o mesmo convivente dentro da janela e libera outro na sequencia', () => {
    const ref = { current: { conviventeId: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-a'), false);
    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-a'), true);
    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-b'), false);
  });
});
