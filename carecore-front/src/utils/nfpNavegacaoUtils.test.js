import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  nfpEstadoVolta,
  nfpOrigemAtual,
  nfpVoltarPara,
  nfpVoltarState,
} from './nfpNavegacaoUtils.js';

describe('nfpNavegacaoUtils', () => {
  it('origem inclui search', () => {
    assert.equal(nfpOrigemAtual({ pathname: '/nfp', search: '?x=1' }), '/nfp?x=1');
  });

  it('voltar usa from quando é rota NFP', () => {
    assert.equal(
      nfpVoltarPara({ pathname: '/nfp/cadastro/cnpjs', state: { from: '/nfp' } }),
      '/nfp',
    );
    assert.equal(
      nfpVoltarPara({ pathname: '/nfp/relatorios/cupons', state: { from: '/nfp/relatorios' } }, '/nfp/relatorios'),
      '/nfp/relatorios',
    );
    assert.equal(
      nfpVoltarPara({ pathname: '/nfp/metas', state: { from: '/compras' } }),
      '/nfp',
    );
  });

  it('encadeia snapshot do dashboard', () => {
    const st = nfpEstadoVolta(
      { pathname: '/nfp/relatorios', state: { nfpAba: 'rateio', nfpCompetencia: '2026-11' } },
      {},
    );
    assert.equal(st.from, '/nfp/relatorios');
    assert.equal(st.nfpAba, 'rateio');
    assert.equal(st.nfpCompetencia, '2026-11');
    assert.deepEqual(
      nfpVoltarState({ state: st }),
      { nfpAba: 'rateio', nfpCompetencia: '2026-11' },
    );
  });
});
