import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  conflitosNomeCadastro,
  nomesCadastroSemelhantes,
  nomesSaoSemelhantes,
  rotuloCategoria,
  rotuloUsoCategoria,
} from './comprasCategoriaUtils.js';

const EXISTENTES = [
  'Alimentação',
  'Carne',
  'Higiene e limpeza',
  'Higiene pessoal',
  'EPI',
];

describe('comprasCategoriaUtils', () => {
  it('bloqueia higiene genérica diante das categorias dos itens', () => {
    const achados = nomesCadastroSemelhantes('Higiene', EXISTENTES);
    assert.equal(achados.includes('Higiene e limpeza'), true);
    assert.equal(achados.includes('Higiene pessoal'), true);
  });

  it('reconhece abreviação de higiene e limpeza', () => {
    assert.equal(nomesSaoSemelhantes('Hig e limpeza', 'Higiene e limpeza'), true);
  });

  it('não mistura carne com alimentação', () => {
    assert.deepEqual(nomesCadastroSemelhantes('Carne', EXISTENTES), []);
  });

  it('bloqueia o mesmo nome já usado nos itens', () => {
    assert.deepEqual(conflitosNomeCadastro('alimentação', EXISTENTES), ['Alimentação']);
  });

  it('mostra a quantidade de itens no rótulo', () => {
    assert.equal(rotuloCategoria({ nome: 'Alimentação', qtd_itens: 80 }), 'Alimentação (80)');
  });

  it('detalha uso de consumo e bens', () => {
    assert.equal(rotuloUsoCategoria({ qtd_itens: 0 }), '0');
    assert.equal(rotuloUsoCategoria({ qtd_itens: 28, qtd_itens_consumo: 28, qtd_bens: 0 }), '28');
    assert.equal(rotuloUsoCategoria({ qtd_itens: 1380, qtd_itens_consumo: 0, qtd_bens: 1380 }), '1380 bens');
    assert.equal(
      rotuloUsoCategoria({ qtd_itens: 10, qtd_itens_consumo: 2, qtd_bens: 8 }),
      '10 (2 consumo · 8 bens)',
    );
  });
});
