import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filtrarItensComSaldoPontos,
  montarDadosExportacaoRankingPontos,
  resolverItensRelatorioPontosBrindes,
} from './atividadesPontosBrindesPrintHelpers.js';

test('filtrarItensComSaldoPontos mantém apenas saldo positivo', () => {
  const itens = filtrarItensComSaldoPontos([
    { nome: 'A', saldo_pontos: 3 },
    { nome: 'B', saldo_pontos: 0 },
    { nome: 'C', saldo_pontos: -1 },
    { nome: 'D', saldo_pontos: 10 },
  ]);
  assert.deepEqual(itens.map((i) => i.nome), ['A', 'D']);
});

test('resolverItensRelatorioPontosBrindes prioriza selecionado', () => {
  const ranking = [
    { convivente_id: '1', nome: 'Ana', saldo_pontos: 2, posicao: 1 },
    { convivente_id: '2', nome: 'Bia', saldo_pontos: 5, posicao: 2 },
  ];
  const resolvido = resolverItensRelatorioPontosBrindes({
    ranking,
    selecionado: ranking[1],
  });
  assert.equal(resolvido.escopo, 'selecionado');
  assert.equal(resolvido.itens.length, 1);
  assert.equal(resolvido.itens[0].nome, 'Bia');
});

test('resolverItensRelatorioPontosBrindes sem seleção usa quem tem saldo', () => {
  const ranking = [
    { convivente_id: '1', nome: 'Ana', saldo_pontos: 0, posicao: 1 },
    { convivente_id: '2', nome: 'Bia', saldo_pontos: 5, posicao: 2 },
  ];
  const resolvido = resolverItensRelatorioPontosBrindes({ ranking, selecionado: null });
  assert.equal(resolvido.escopo, 'com_saldo');
  assert.equal(resolvido.itens.length, 1);
  assert.equal(resolvido.itens[0].nome, 'Bia');
});

test('montarDadosExportacaoRankingPontos mapeia colunas', () => {
  const dados = montarDadosExportacaoRankingPontos([
    {
      posicao: 3,
      nome: 'Carlos',
      numero_institucional: 100,
      total_presencas: 4,
      pontos_ganhos: 4,
      pontos_utilizados: 1,
      saldo_pontos: 3,
    },
  ]);
  assert.deepEqual(dados[0], {
    '#': 3,
    Convivente: 'Carlos',
    Prontuário: 100,
    Presenças: 4,
    Ganhos: 4,
    Usados: 1,
    Saldo: 3,
  });
});
