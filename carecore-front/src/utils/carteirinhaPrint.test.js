import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarHtmlCarteirinhaUnitaria,
  prefixarEstiloCarteirinha,
  resolverDadosCarteirinha,
} from './carteirinhaDados.js';

describe('prefixarEstiloCarteirinha', () => {
  it('prefixa seletores com escopo da carteirinha', () => {
    const css = '.head { background: #ea580c; } .acom { color: red; }';
    const resultado = prefixarEstiloCarteirinha(css, 'cc-lote-42');

    assert.match(resultado, /\.cc-lote-42 \.head \{ background: #ea580c; \}/);
    assert.match(resultado, /\.cc-lote-42 \.acom \{ color: red; \}/);
  });
});

describe('gerarHtmlCarteirinhaUnitaria', () => {
  it('gera cores distintas para provisória e padrão', () => {
    const conviventePadrao = {
      id: '1',
      nome_completo: 'Convivente A',
      leito_id: 'l1',
      numero_institucional: '100',
    };
    const conviventeProvisorio = {
      id: '2',
      nome_completo: 'Convivente B',
      leito_id: 'l2',
      leito_provisorio_desde: '2026-06-25T10:00:00',
      numero_institucional: '101',
    };
    const quartos = [
      {
        id: 'q1',
        nome: 'Quarto 1',
        modalidade: 'Fixo',
        rotativo: false,
        leitos: [{ id: 'l1', identificacao: 'A' }],
      },
      {
        id: 'q2',
        nome: 'Rotativo',
        modalidade: 'Transitorio',
        rotativo: true,
        leitos: [{ id: 'l2', identificacao: 'B' }],
      },
    ];

    const htmlPadrao = gerarHtmlCarteirinhaUnitaria(
      resolverDadosCarteirinha(conviventePadrao, quartos, []),
    );
    const htmlProvisorio = gerarHtmlCarteirinhaUnitaria(
      resolverDadosCarteirinha(conviventeProvisorio, quartos, []),
    );

    assert.match(htmlPadrao, /background: #0ea5e9/);
    assert.match(htmlProvisorio, /background: #ea580c/);
    assert.notEqual(htmlPadrao, htmlProvisorio);
  });
});
