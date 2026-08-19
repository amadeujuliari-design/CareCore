import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  detectarSemanaUtil,
  formatarFaixa,
  montarDiasCalendario,
  periodoSemanaUtilMes,
  validarPeriodoJanela,
} from './comprasJanelaUtils.js';

describe('comprasJanelaUtils', () => {
  it('formata a faixa no estilo do cartaz', () => {
    assert.equal(formatarFaixa('2026-08-10', '2026-08-14'), '10 a 14/08/2026');
  });

  it('marca dias liberados como clicáveis só no futuro ou hoje', () => {
    const dias = montarDiasCalendario(2026, 8, {
      hoje: '2026-08-17',
      diasLiberados: ['2026-08-10', '2026-08-22'],
    });
    const dez = dias.find((item) => item.iso === '2026-08-10');
    const vinteDois = dias.find((item) => item.iso === '2026-08-22');
    assert.equal(dez.liberado, true);
    assert.equal(dez.clicavel, false);
    assert.equal(vinteDois.liberado, true);
    assert.equal(vinteDois.clicavel, true);
  });

  it('calcula a 2ª semana útil de agosto/2026', () => {
    const periodo = periodoSemanaUtilMes(2026, 8, 2);
    assert.equal(periodo.data_inicio, '2026-08-10');
    assert.equal(periodo.data_fim, '2026-08-14');
    assert.equal(formatarFaixa(periodo.data_inicio, periodo.data_fim), '10 a 14/08/2026');
  });

  it('detecta semana padrão e período personalizado', () => {
    assert.equal(detectarSemanaUtil('2026-08', '2026-08-10', '2026-08-14'), 2);
    assert.equal(detectarSemanaUtil('2026-09', '2026-09-14', '2026-09-18'), null);
  });

  it('recusa fim anterior ao início e datas de outro mês', () => {
    assert.match(validarPeriodoJanela('2026-08-24', '2026-08-21', '2026-08'), /anterior/);
    assert.match(validarPeriodoJanela('2026-08-24', '2026-08-28', '2026-09'), /Setembro/);
    assert.equal(validarPeriodoJanela('2026-09-14', '2026-09-18', '2026-09'), '');
  });
});
