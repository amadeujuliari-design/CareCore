import test from 'node:test';
import assert from 'node:assert/strict';

import {
  montarColunasMetasMensal,
  montarLinhasMetasMensal,
  montarMetricasMetasMensal,
  OPCOES_IMPRESSAO_METAS_PADRAO,
} from './relatorioNfpMetasPrintUtils.js';

test('colunas mensais respeitam opções de inclusão', () => {
  const todas = montarColunasMetasMensal(OPCOES_IMPRESSAO_METAS_PADRAO);
  assert.ok(todas.includes('Soulcial'));
  assert.ok(todas.includes('Diego'));
  assert.ok(todas.includes('% dig.'));

  const enxuto = montarColunasMetasMensal({
    incluirPercentuais: false,
    incluirValoresRateio: false,
    incluirSoulcial: false,
    incluirDiego: false,
  });
  assert.deepEqual(enxuto, ['Projeto', 'Digitadas', 'Doadas', 'Total']);
});

test('linhas e metricas formatam valores pt-BR', () => {
  const dados = {
    competencia: '2026-07',
    ref_credito: '2026-03',
    cabecalho: { f35_digitado: 1000, f36_doado: 2000, soulcial_base: 0, total_captador: 500 },
    calculado: {
      h35_projetos: 700,
      h36_projetos: 1400,
      valor_diego: 250,
      total_rateio_geral: 3000,
      digitadas_projetos: 10,
      digitadas_geral: 20,
    },
    linhas: [{
      codigo_projeto: 'SEDE',
      digitadas: 1000,
      doadas: 10,
      pct_digitadas: 0.5,
      pct_doadas: 0.25,
      valor_digitado: 100,
      valor_aplicativo: 200,
      valor_total: 300,
      soulcial: 10,
      soulcial_campanhas: 20,
      diego: 250,
      total: 580,
    }],
  };
  const linhas = montarLinhasMetasMensal(dados);
  assert.equal(linhas[0].Projeto, 'SEDE');
  assert.match(String(linhas[0].Total), /R\$/);
  const metricas = montarMetricasMetasMensal(dados);
  assert.ok(metricas.length >= 8);
  assert.equal(montarMetricasMetasMensal(dados, { incluirResumo: false }).length, 0);
});
