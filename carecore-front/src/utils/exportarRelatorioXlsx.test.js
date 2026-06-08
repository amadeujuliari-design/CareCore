import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  criarArquivoXlsx,
  montarLinhasRelatorioXlsx,
} from './exportarRelatorioXlsx.js';

describe('exportarRelatorioXlsx', () => {
  it('monta linhas com filtros, dados e direitos reservados', () => {
    const linhas = montarLinhasRelatorioXlsx({
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
});
