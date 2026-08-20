import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  criarArquivoXlsx,
  montarLinhasRelatorioXlsx,
  nomeColuna,
} from './exportarRelatorioXlsx.js';
import {
  COLUNAS_RATEIO_DETALHADO,
  montarBlocoTotaisRateioDetalhadoXlsx,
  montarExportacaoRateioDetalhadoXlsx,
} from './relatorioNfpUtils.js';

describe('exportarRelatorioXlsx', () => {
  it('monta linhas com filtros, dados e direitos reservados', () => {
    const { linhas } = montarLinhasRelatorioXlsx({
      titulo: 'Relatório Teste',
      filtros: { Status: 'Ativo' },
      colunas: ['Nome', 'Status'],
      dados: [{ Nome: 'Ana', Status: 'Ativo' }],
      dataAtual: '08/06/2026 00:00:00',
    });

    assert.deepEqual(linhas[0], ['Relatório Teste']);
    assert.deepEqual(linhas[3], ['FILTROS']);
    assert.deepEqual(linhas[4], ['Status: Ativo']);
    assert.deepEqual(linhas[6], ['Nome', 'Status']);
    assert.deepEqual(linhas[7], ['Ana', 'Ativo']);
    assert.ok(linhas.some((linha) => String(linha[0]).includes('CARECORE+')));
  });

  it('gera arquivo XLSX como pacote ZIP minimo', () => {
    const bytes = criarArquivoXlsx([
      ['Relatório Teste'],
      ['Nome', 'Status'],
      ['Ana', 'Ativo'],
    ], 2);

    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);

    const conteudo = new TextDecoder().decode(bytes);
    assert.match(conteudo, /\[Content_Types\]\.xml/);
    assert.match(conteudo, /xl\/worksheets\/sheet1\.xml/);
    assert.match(conteudo, /Relat.rio Teste/u);
  });

  it('grava fórmula Excel com valor em cache', () => {
    const bytes = criarArquivoXlsx([
      ['Total', { formula: 'SUM(A2:A3)', value: 30 }],
      [10],
      [20],
    ], 2);
    const conteudo = new TextDecoder().decode(bytes);
    assert.match(conteudo, /<f>SUM\(A2:A3\)<\/f>/);
    assert.match(conteudo, /<v>30<\/v>/);
    assert.match(conteudo, /fullCalcOnLoad="1"/);
  });

  it('monta totais do rateio detalhado com SUM/SUMIF', () => {
    const dados = montarExportacaoRateioDetalhadoXlsx({
      linhas: [
        {
          cnpj: '1',
          loja: 'A',
          captador: 'DIEGO',
          origem: 'DIEGO',
          fonte: 'CPF',
          qtd: 1,
          retorno: 108.48,
          retorno_loja: 0,
          retorno_cpf: 108.48,
          valor_agente: 54.24,
          valor_aeb: 54.24,
          final: 108.48,
          competencia: '2026-08',
        },
        {
          cnpj: '2',
          loja: 'B',
          captador: 'DIEGO',
          origem: 'DOADOR_AUTOMATICO_DIEGO',
          fonte: 'Doador AEB',
          qtd: 1,
          retorno: 10,
          retorno_loja: 10,
          retorno_cpf: 0,
          valor_agente: 0,
          valor_aeb: 10,
          final: 10,
          competencia: '2026-08',
        },
      ],
    });
    assert.equal(dados[0]['Retorno CPF'], 108.48);
    assert.equal(dados[1].Fonte, 'Doador AEB');

    const bloco = montarBlocoTotaisRateioDetalhadoXlsx({
      colunas: COLUNAS_RATEIO_DETALHADO,
      primeiraLinhaDados: 10,
      ultimaLinhaDados: 11,
      totais: {
        bruto_lojas_cpfs_agente: 118.48,
        bruto_lojas_somente: 10,
        bruto_cpf_agente: 108.48,
        doador_aeb_loja_agente: 10,
        parte_agente: 54.24,
        parte_aeb: 64.24,
      },
      rotuloParte: 'Parte DIEGO',
      rotuloDoador: 'Doador AEB em lojas DIEGO',
      nomeColunaFn: nomeColuna,
    });
    assert.equal(bloco[0].label, 'Bruto Lojas/CPFs');
    assert.match(bloco[0].celula.formula, /^SUM\(/);
    assert.match(bloco[3].celula.formula, /SUMIF/);
    assert.equal(bloco[4].label, 'Parte DIEGO');
  });
});
