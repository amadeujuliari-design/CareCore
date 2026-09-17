import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatarDataBr, formatarDataHoraBr } from './dataBrasilUtils.js';

describe('formatarDataHoraBr', () => {
  it('mostra data e hora de datetime naive ISO com T', () => {
    assert.equal(formatarDataHoraBr('2026-09-17T15:32:08'), '17/09/2026 15:32');
  });

  it('mostra data e hora com espaço (formato do backend)', () => {
    assert.equal(formatarDataHoraBr('2026-09-17 09:05:00'), '17/09/2026 09:05');
  });

  it('mantém só a data quando não há hora', () => {
    assert.equal(formatarDataHoraBr('2026-09-17'), '17/09/2026');
    assert.equal(formatarDataBr('2026-09-17'), '17/09/2026');
  });

  it('retorna vazio para valor ausente', () => {
    assert.equal(formatarDataHoraBr(''), '');
    assert.equal(formatarDataHoraBr(null), '');
  });
});
