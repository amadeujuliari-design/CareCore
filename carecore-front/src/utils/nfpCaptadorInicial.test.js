import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { captadorInicialDoProjeto } from './nfpCaptadorInicial.js';

const OPCOES = [
  { value: 'SEDE AEB', label: '001 — SEDE AEB' },
  { value: 'REENCONTRO PARI', label: '012 — REENCONTRO PARI' },
  { value: 'REENCONTRO ANHANGABAÚ', label: '013 — REENCONTRO ANHANGABAÚ' },
];

describe('captador inicial da leitura NFP', () => {
  it('abre no projeto logado', () => {
    assert.equal(captadorInicialDoProjeto(OPCOES, 'REENCONTRO PARI'), 'REENCONTRO PARI');
    assert.equal(
      captadorInicialDoProjeto(OPCOES, 'Reencontro Anhangabau'),
      'REENCONTRO ANHANGABAÚ',
    );
  });

  it('sede e projeto desconhecido ficam sem sugestão', () => {
    assert.equal(captadorInicialDoProjeto(OPCOES, 'SEDE AEB'), '');
    assert.equal(captadorInicialDoProjeto(OPCOES, 'CASA PORTO'), '');
  });
});
