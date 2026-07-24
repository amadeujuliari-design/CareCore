import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatarEvolucoesTexto,
  montarFiltrosRotuloPot,
  montarItensRodapeIdentidade,
} from './potListaExportPrintHelpers.js';

test('montarFiltrosRotuloPot inclui filtros da tela', () => {
  const filtros = montarFiltrosRotuloPot({
    busca: 'Silel',
    dataInicio: '2026-01-01',
    dataFim: '2026-07-24',
    filtrosExtras: {
      status_convivente: 'Ativo',
      local: 'POT I',
      situacao_atual: 'Em participação',
    },
    total: 12,
  });

  assert.equal(filtros.Busca, 'Silel');
  assert.equal(filtros['Status convivente'], 'Ativo');
  assert.equal(filtros.Local, 'POT I');
  assert.equal(filtros['Situação POT'], 'Em participação');
  assert.equal(filtros['Total filtrado'], 12);
  assert.match(filtros['Período inserção'], /01\/01\/2026/);
});

test('montarFiltrosRotuloPot registra opção de detalhes', () => {
  const comDetalhe = montarFiltrosRotuloPot({ total: 1, incluirEvolucoes: true });
  const semDetalhe = montarFiltrosRotuloPot({ total: 1, incluirEvolucoes: false });
  assert.equal(comDetalhe.Detalhes, 'Com evoluções');
  assert.equal(semDetalhe.Detalhes, 'Sem evoluções');
});

test('montarFiltrosRotuloPot inclui técnico', () => {
  const filtros = montarFiltrosRotuloPot({
    total: 3,
    tecnicoRotulo: 'CIBELE CONELHEIRO',
  });
  assert.equal(filtros['Técnico'], 'CIBELE CONELHEIRO');
});

test('formatarEvolucoesTexto resume linha do tempo', () => {
  const texto = formatarEvolucoesTexto([
    { data_evolucao: '2026-07-01', status_evolucao: 'Em participação', observacoes: 'Ok' },
    { data_evolucao: '2026-07-10', status_evolucao: 'Congelamento' },
  ]);
  assert.match(texto, /01\/07\/2026 · Em participação — Ok/);
  assert.match(texto, /10\/07\/2026 · Congelamento/);
});

test('montarItensRodapeIdentidade usa personalização do cliente', () => {
  const itens = montarItensRodapeIdentidade({
    relatorio_rodape_linha1: 'AEB — SIAT',
    relatorio_rodape_linha2: 'Unidade Centro',
    relatorio_telefone: '(11) 0000-0000',
    relatorio_email: 'contato@exemplo.org',
    relatorio_site: 'https://exemplo.org',
  });
  assert.deepEqual(itens, [
    'AEB — SIAT',
    'Unidade Centro',
    'Telefone: (11) 0000-0000',
    'E-mail: contato@exemplo.org',
    'Site: https://exemplo.org',
  ]);
});
