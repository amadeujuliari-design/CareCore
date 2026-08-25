import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  chaveSplitCategoriaPedido,
  fornecedorSemCategoria,
  fornecedoresParaCotacaoPedido,
  itensConsumoDoSegmentoPedido,
  itensConsumoDoSplitPedido,
  segmentoFornecedorDoTipoPedido,
  sugerirFornecedoresBusca,
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

describe('fornecedoresParaCotacaoPedido', () => {
  const categorias = [
    { id: 'hig', nome: 'Higiene', segmento: 'consumo' },
    { id: 'man', nome: 'Manutenção', segmento: 'manutencao' },
    { id: 'bem', nome: 'Bem / imobilizado', segmento: 'imobilizado' },
    { id: 'srv', nome: 'Serviços', segmento: 'servico' },
  ];
  const fornecedores = [
    { id: 'sem', nome: 'Sem categoria' },
    { id: 'hig1', nome: 'Limpeza SA', categoria_ids: ['hig'] },
    { id: 'man1', nome: 'Manutencao SA', categoria_id: 'man' },
    { id: 'bem1', nome: 'Moveis SA', categoria_ids: ['bem', 'hig'] },
    { id: 'srv1', nome: 'Servicos SA', categoria_ids: ['srv'] },
  ];

  it('sem categoria entra em qualquer tipo', () => {
    assert.equal(fornecedorSemCategoria(fornecedores[0]), true);
    for (const tipo of ['consumo', 'manutencao', 'imobilizado', 'servico']) {
      const ids = fornecedoresParaCotacaoPedido(fornecedores, categorias, tipo).map((f) => f.id);
      assert.ok(ids.includes('sem'));
    }
  });

  it('filtra pelo segmento do pedido quando tem categoria', () => {
    assert.deepEqual(
      fornecedoresParaCotacaoPedido(fornecedores, categorias, 'consumo').map((f) => f.id),
      ['sem', 'hig1', 'bem1'],
    );
    assert.deepEqual(
      fornecedoresParaCotacaoPedido(fornecedores, categorias, 'manutencao').map((f) => f.id),
      ['sem', 'man1'],
    );
    assert.deepEqual(
      fornecedoresParaCotacaoPedido(fornecedores, categorias, 'imobilizado').map((f) => f.id),
      ['sem', 'bem1'],
    );
    assert.deepEqual(
      fornecedoresParaCotacaoPedido(fornecedores, categorias, 'servico').map((f) => f.id),
      ['sem', 'srv1'],
    );
  });

  it('mapeia tipo serviço para segmento serviço', () => {
    assert.equal(segmentoFornecedorDoTipoPedido('servico'), 'servico');
    assert.equal(segmentoFornecedorDoTipoPedido('consumo'), 'consumo');
  });
});

describe('sugerirFornecedoresBusca', () => {
  const lista = [
    { id: '1', nome: 'CARECORE TESTE Compras1', email: 'a@x.com' },
    { id: '2', nome: 'Mercado Central', email: 'mercado@x.com' },
    { id: '3', nome: 'Ação Limpeza', email: 'acao@x.com' },
    { id: '4', nome: 'Beta Alimentos', email_empresa: 'beta@x.com' },
  ];

  it('mostra resultados a partir da 1ª letra (prefixo)', () => {
    const ids = sugerirFornecedoresBusca(lista, 'c').map((f) => f.id);
    assert.ok(ids.includes('1')); // CARECORE…
    assert.ok(ids.includes('2')); // …Central
    assert.ok(!ids.includes('3')); // Ação — "c" no meio, curto demais
    assert.ok(!ids.includes('4'));
  });

  it('normaliza acento na busca', () => {
    const ids = sugerirFornecedoresBusca(lista, 'acao').map((f) => f.id);
    assert.deepEqual(ids, ['3']);
  });

  it('sem termo não lista ninguém (typeahead)', () => {
    assert.deepEqual(sugerirFornecedoresBusca(lista, ''), []);
    assert.deepEqual(sugerirFornecedoresBusca(lista, '  '), []);
  });
});
