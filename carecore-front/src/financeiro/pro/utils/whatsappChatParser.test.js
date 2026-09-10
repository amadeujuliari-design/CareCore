import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseWhatsappDebtBody,
  parseWhatsappMoney,
  parseWhatsappChatImport,
  resolveWhatsappResponsible,
  summarizeWhatsappCycle,
  contentAfterLastZerado,
} from './whatsappChatParser.js';

describe('whatsappChatParser — dinheiro', () => {
  it('lê milhar BR', () => {
    assert.equal(parseWhatsappMoney('11.755,30'), 11755.3);
    assert.equal(parseWhatsappMoney('813,59'), 813.59);
  });
});

describe('whatsappChatParser — responsáveis', () => {
  it('corrige typo Ledo e aliases', () => {
    assert.equal(resolveWhatsappResponsible('Ledo'), 'Léo');
    assert.equal(resolveWhatsappResponsible('Eu'), 'Léo');
    assert.equal(resolveWhatsappResponsible('Claydio'), 'Claudio');
  });

  it('infere pelo autor quando falta o nome', () => {
    assert.equal(resolveWhatsappResponsible('', 'AClaudioj'), 'Léo');
    assert.equal(resolveWhatsappResponsible('', 'Leo Leandro'), 'Claudio');
  });
});

describe('whatsappChatParser — linhas problemáticas do histórico', () => {
  const cases = [
    ['Leo deve280,00 ingresso Alok', 'Léo', 280, 'ingresso Alok'],
    ['Ledo deve 15,45 padaria', 'Léo', 15.45, 'padaria'],
    ['Leo deve cerveja do mercado: 26,98', 'Léo', 26.98, 'cerveja do mercado'],
    ['Leo deve compras mercado 10,59', 'Léo', 10.59, 'compras mercado'],
    ['Leo deve van 21/04 62,50', 'Léo', 62.5, 'van 21/04'],
    ['Leo deve mega sena 01/02 25,00', 'Léo', 25, 'mega sena 01/02'],
    ['Leo deve desse boleto 11.755,30', 'Léo', 11755.3, 'desse boleto'],
    ['Deve 147,00 cerveja e aperol Praia Grande', 'Léo', 147, 'cerveja e aperol Praia Grande'],
    ['Deve 29,67 cerveja cooler carro', 'Léo', 29.67, 'cerveja cooler carro'],
    ['Cláudio deve 2x32,50 presente Rita', 'Claudio', 32.5, 'presente Rita'],
    ['Léo deve 5x 99,50 ótica', 'Léo', 99.5, 'ótica'],
    ['Léo deve 10,30 bolo <Mensagem editada>', 'Léo', 10.3, 'bolo'],
  ];

  for (const [line, resp, amount, descPart] of cases) {
    it(`parseia: ${line.slice(0, 48)}`, () => {
      const author = resp === 'Claudio' && line.startsWith('Cláudio') ? 'Leo Leandro' : 'AClaudioj';
      const debt = parseWhatsappDebtBody(line, author);
      assert.ok(debt, `deveria parsear: ${line}`);
      assert.equal(debt.responsible, resp);
      assert.equal(debt.amount, amount);
      assert.match(debt.description.toLowerCase(), new RegExp(descPart.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }

  it('ignora conversa de acerto (deve pagar / saldo)', () => {
    assert.equal(parseWhatsappDebtBody('Léo deve pagar 15,00', 'AClaudioj'), null);
    assert.equal(parseWhatsappDebtBody('Saldo q Cláudio deve para Léo = 36,00', 'AClaudioj'), null);
  });

  it('lê parcelas em Cláudio deve 2x32,50', () => {
    const debt = parseWhatsappDebtBody('Cláudio deve 2x32,50 presente Rita', 'Leo Leandro');
    assert.equal(debt.installments, 2);
  });
});

describe('whatsappChatParser — ciclo após zerado', () => {
  it('usa só o trecho após o último zerado e herda data semente', () => {
    const sample = `[08/08/2026, 10:00:00] AClaudioj: Léo deve 10,00 antigo
[09/08/2026, 07:36:13] AClaudioj: Zerado nessa data
_______________________________
Leo deve 50,76 plano odontológico
[09/08/2026, 07:40:09] AClaudioj: Léo deve 40,76 Omo líquido
[20/08/2026, 15:02:07] AClaudioj: Léo deve 3x 43,34 camisa
`;
    const { seedDate } = contentAfterLastZerado(sample);
    assert.ok(seedDate);
    assert.equal(seedDate.getDate(), 9);
    assert.equal(seedDate.getMonth(), 7);

    const items = parseWhatsappChatImport(sample, { userId: 'u1' });
    assert.equal(items.some((t) => t.description.includes('antigo')), false);
    assert.equal(items.filter((t) => t.description.includes('plano odontológico')).length, 1);
    assert.equal(items.filter((t) => t.description.includes('Omo')).length, 1);
    assert.equal(items.filter((t) => t.description.includes('camisa')).length, 3);
    assert.equal(items.filter((t) => t.is_projected).length, 2);
  });

  it('resume ciclo real vs projeção', () => {
    const s = summarizeWhatsappCycle(
      [
        { is_paid: false, is_projected: false, date: '2026-09-01' },
        { is_paid: false, is_projected: false, date: '2026-09-08' },
        { is_paid: false, is_projected: true, date: '2026-10-01' },
        { is_paid: true, is_projected: false, date: '2026-08-01' },
      ],
      '2026-09-08',
    );
    assert.deepEqual(s, {
      totalHistorico: 4,
      itensNoCiclo: 2,
      parcelasProjetadasAbertas: 1,
    });
  });
});
