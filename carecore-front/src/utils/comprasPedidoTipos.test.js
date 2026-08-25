import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  chaveSplitCategoriaPedido,
  itensConsumoDoSegmentoPedido,
  itensConsumoDoSplitPedido,
} from './comprasPedidoTipos.js';

describe('chaveSplitCategoriaPedido', () => {
  it('agrupa carne / peixe / alimentação', () => {
    assert.deepEqual(chaveSplitCategoriaPedido('Carne bovina'), ['carne', 'Carne']);
    assert.deepEqual(chaveSplitCategoriaPedido('Peixe fresco'), ['peixe', 'Peixe']);
    assert.deepEqual(chaveSplitCategoriaPedido('Alimentação'), ['alimentacao', 'Alimentação']);
  });

  it('usa id nas demais categorias', () => {
    assert.deepEqual(
      chaveSplitCategoriaPedido('Higiene e limpeza', 'cat-hig'),
      ['cat:cat-hig', 'Higiene e limpeza'],
    );
  });

  it('não usa o texto do item para tirar de Alimentação', () => {
    assert.deepEqual(
      chaveSplitCategoriaPedido('Alimentação', 'ali'),
      ['alimentacao', 'Alimentação'],
    );
  });
});

describe('itensConsumoDoSplitPedido', () => {
  const itens = [
    { id: '1', descricao: 'Detergente', categoria_id: 'hig', categoria_nome: 'Higiene e limpeza', segmento: 'consumo' },
    { id: '2', descricao: 'Carne Seca', categoria_id: 'car', categoria_nome: 'Carne', segmento: 'consumo' },
    { id: '3', descricao: 'Arroz', categoria_id: 'ali', categoria_nome: 'Alimentação', segmento: 'consumo' },
    { id: '4', descricao: 'Acem Isca', categoria_id: 'ali', categoria_nome: 'Alimentação', segmento: 'consumo' },
    { id: '5', descricao: 'Fita Isolante', categoria_id: 'man', categoria_nome: 'Manutenção', segmento: 'manutencao' },
  ];

  it('sem split devolve só o segmento do tipo', () => {
    assert.deepEqual(
      itensConsumoDoSplitPedido(itens, { tipo: 'consumo', grupo_split_id: null }).map((i) => i.id),
      ['1', '2', '3', '4'],
    );
  });

  it('pedido consumo não lista itens de manutenção', () => {
    const filtrados = itensConsumoDoSplitPedido(itens, {
      tipo: 'consumo',
      grupo_split_id: 'abc',
      categoria_split_id: 'ali',
      categoria_split_nome: 'Alimentação',
    });
    assert.ok(!filtrados.some((i) => i.id === '5'));
  });

  it('filtra pela categoria do pedido separado', () => {
    const filtrados = itensConsumoDoSplitPedido(itens, {
      tipo: 'consumo',
      grupo_split_id: 'abc',
      categoria_split_id: 'hig',
      categoria_split_nome: 'Higiene e limpeza',
    });
    assert.deepEqual(filtrados.map((i) => i.id), ['1']);
  });

  it('filtra grupo carne pela categoria Carne', () => {
    const filtrados = itensConsumoDoSplitPedido(itens, {
      tipo: 'consumo',
      grupo_split_id: 'abc',
      categoria_split_id: 'car',
      categoria_split_nome: 'Carne',
    });
    assert.deepEqual(filtrados.map((i) => i.id), ['2']);
  });

  it('alimentação inclui itens ainda cadastrados nela', () => {
    const filtrados = itensConsumoDoSplitPedido(itens, {
      tipo: 'consumo',
      grupo_split_id: 'abc',
      categoria_split_id: 'ali',
      categoria_split_nome: 'Alimentação',
    });
    assert.deepEqual(filtrados.map((i) => i.id).sort(), ['3', '4']);
  });
});

describe('itensConsumoDoSegmentoPedido', () => {
  it('serviço não usa catálogo de produto', () => {
    assert.deepEqual(itensConsumoDoSegmentoPedido([{ id: '1', segmento: 'servico' }], 'servico'), []);
  });
});
