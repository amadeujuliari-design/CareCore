import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { centavosParaInput, reaisParaCentavos, rotuloOpcao } from './comprasPatrimonioUtils.js';

describe('comprasPatrimonioUtils', () => {
  it('converte reais com vírgula para centavos', () => {
    assert.equal(reaisParaCentavos('1.330,50'), 133050);
    assert.equal(reaisParaCentavos('132'), 13200);
    assert.equal(reaisParaCentavos(''), null);
  });

  it('formata centavos para o campo de valor', () => {
    assert.equal(centavosParaInput(13200), '132,00');
  });

  it('resolve o rótulo da opção', () => {
    assert.equal(rotuloOpcao([{ value: 'aeb', label: 'AEB' }], 'aeb'), 'AEB');
  });
});
