import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_RETRATOS_DASHBOARD,
  montarDadosRetratosDashboard,
  montarMetricasRetratosDashboard,
} from './dashboardOperacionalRetratosPrintHelpers.js';

test('montarDadosRetratosDashboard usa chaves iguais às colunas do imprimirRelatorio', () => {
  const dados = montarDadosRetratosDashboard([
    {
      data_referencia: '2026-07-18',
      capturado_em: '2026-07-18T22:40:00',
      resumo: {
        dentro_projeto: 150,
        fora_projeto: 40,
        total_interacoes_hoje: 500,
        total_registros_hoje: 900,
      },
      ajustes_manuais: { tem_ajuste: true, total_complemento: 100 },
    },
    {
      data_referencia: '2026-07-17',
      capturado_em: '2026-07-17T22:40:00',
      resumo: {
        dentro_projeto: 140,
        fora_projeto: 45,
        total_interacoes_hoje: 480,
        total_registros_hoje: 800,
      },
      ajustes_manuais: { tem_ajuste: false, total_complemento: 0 },
    },
  ]);

  assert.equal(dados.length, 2);
  assert.equal(dados[0].Data, '17/07/2026');
  assert.equal(dados[1].Data, '18/07/2026');
  assert.equal(dados[1]['Ajuste manual'], '+100');
  assert.equal(dados[0]['Ajuste manual'], '—');
  assert.equal(dados[1].Dentro, 150);
  for (const coluna of COLUNAS_RETRATOS_DASHBOARD) {
    assert.equal(typeof coluna, 'string');
    assert.notEqual(dados[0][coluna], undefined);
  }
});

test('montarMetricasRetratosDashboard usa label no padrao do imprimirRelatorio', () => {
  const metricas = montarMetricasRetratosDashboard([
    {
      data_referencia: '2026-07-17',
      resumo: { dentro_projeto: 100, fora_projeto: 20 },
      ajustes_manuais: { tem_ajuste: true, total_complemento: 10 },
    },
    {
      data_referencia: '2026-07-18',
      resumo: { dentro_projeto: 200, fora_projeto: 40 },
      ajustes_manuais: { tem_ajuste: false },
    },
  ]);
  const mapa = Object.fromEntries(metricas.map((m) => [m.label, m.valor]));
  assert.equal(mapa['Dias no período'], 2);
  assert.equal(mapa['Com ajuste manual'], 1);
  assert.equal(mapa['Média dentro'], 150);
  assert.equal(mapa['Média fora'], 30);
});
