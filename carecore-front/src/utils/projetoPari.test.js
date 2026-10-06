import test from 'node:test';
import assert from 'node:assert/strict';

import { projetoEhReencontroPari } from './projetoPari.js';

test('modelo do PARI vale para Anhangabaú, Cruzeiro do Sul e Jabaquara', () => {
  assert.equal(projetoEhReencontroPari('REENCONTRO PARI'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO ANHANGABAÚ'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO CRUZEIRO DO SUL'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO JABAQUARA'), true);
  assert.equal(projetoEhReencontroPari('CASA PORTO'), false);
});
