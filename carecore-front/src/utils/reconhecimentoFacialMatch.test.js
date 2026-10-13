import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIMIAR_FACIAL,
  LIMIAR_FACIAL_ALTA,
  classificarCorrespondenciaFacial,
} from './reconhecimentoFacialMatch.js';

describe('reconhecimentoFacialMatch', () => {
  it('trata correspondencia forte como registro automatico', () => {
    assert.equal(classificarCorrespondenciaFacial(0.2), 'alta');
    assert.equal(classificarCorrespondenciaFacial(LIMIAR_FACIAL_ALTA), 'alta');
  });

  it('pede confirmacao na faixa moderada e ignora acima do limiar', () => {
    assert.equal(classificarCorrespondenciaFacial(0.5), 'moderada');
    assert.equal(classificarCorrespondenciaFacial(LIMIAR_FACIAL), 'moderada');
    assert.equal(classificarCorrespondenciaFacial(LIMIAR_FACIAL + 0.01), 'nenhuma');
  });

  it('ignora distancia invalida', () => {
    assert.equal(classificarCorrespondenciaFacial(Number.NaN), 'nenhuma');
  });
});
