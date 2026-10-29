import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NFP_CADASTRO_PAGE_SIZE,
  normalizarListaPaginadaNfp,
} from './nfpListaPaginadaUtils.js';

describe('normalizarListaPaginadaNfp', () => {
  it('aceita resposta paginada da API', () => {
    const data = normalizarListaPaginadaNfp({
      itens: [{ id: '1' }, { id: '2' }],
      paginacao: { total: 582, limite: 50, offset: 0, pagina: 1, total_paginas: 12 },
    });
    assert.equal(data.itens.length, 2);
    assert.equal(data.paginacao.total, 582);
    assert.equal(data.paginacao.total_paginas, 12);
    assert.equal(NFP_CADASTRO_PAGE_SIZE, 50);
  });

  it('aceita array legado sem perder os itens da pagina', () => {
    const data = normalizarListaPaginadaNfp([{ id: 'a' }]);
    assert.equal(data.itens[0].id, 'a');
    assert.equal(data.paginacao.total, 1);
  });
});
