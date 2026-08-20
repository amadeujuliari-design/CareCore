import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filtrarItensConsumo,
  itemConsumoPeloDetalheErro,
  normalizarBuscaItem,
  pedidoItemUnidadeConfusa,
  sugerirItensConsumo,
  unidadeParaPedido,
  sanitizarUnidadeMedida,
  digitarQuantidadeEmbalagem,
} from './comprasItensConsumoUtils.js';

const ITENS = [
  {
    id: '1',
    descricao: 'Álcool 70% gel',
    marca_preferencial: 'Asseptgel',
    categoria_id: 'hig',
    categoria_nome: 'Higiene e limpeza',
    unidade_medida: 'un',
    embalagem: '5 L',
    ativo: true,
  },
  {
    id: '2',
    descricao: 'Arroz tipo 1',
    marca_preferencial: 'Camil',
    categoria_id: 'ali',
    categoria_nome: 'Alimentação',
    unidade_medida: 'kg',
    ativo: true,
  },
  {
    id: '3',
    descricao: 'Fralda G',
    categoria_id: 'pes',
    categoria_nome: 'Higiene pessoal',
    ativo: false,
  },
];

describe('comprasItensConsumoUtils', () => {
  it('normaliza acento para a busca', () => {
    assert.equal(normalizarBuscaItem('Álcool  70%'), 'alcool 70%');
  });

  it('mostra resultados assim que começa a digitar', () => {
    const sugestoes = sugerirItensConsumo(ITENS, 'al');
    assert.equal(sugestoes.length, 2);
    assert.equal(sugestoes[0].descricao, 'Álcool 70% gel');
  });

  it('filtra por categoria e esconde inativo no padrão', () => {
    const lista = filtrarItensConsumo(ITENS, { categoriaId: 'pes', status: 'ativo' });
    assert.equal(lista.length, 0);
    const inativos = filtrarItensConsumo(ITENS, { busca: 'fralda', status: 'inativo' });
    assert.equal(inativos.length, 1);
  });

  it('busca também pela embalagem', () => {
    const lista = filtrarItensConsumo(ITENS, { busca: '5 l', status: 'ativo' });
    assert.equal(lista.length, 1);
    assert.equal(lista[0].id, '1');
  });

  it('busca também por sinônimo', () => {
    const lista = filtrarItensConsumo(
      [{ ...ITENS[0], sinonimos: 'toalha interfolha' }],
      { busca: 'interfolha', status: 'ativo' },
    );
    assert.equal(lista.length, 1);
  });

  it('reusa o item do cadastro quando o erro cita a descrição', () => {
    const achado = itemConsumoPeloDetalheErro(
      ITENS,
      'Já existe item semelhante no cadastro: Álcool 70% gel.',
    );
    assert.equal(achado?.id, '1');
  });

  it('no pedido conta embalagem quando o fator e diferente de 1', () => {
    assert.equal(unidadeParaPedido({ unidade_medida: 'kg', embalagem: 'PCT 2 kg' }), 'un');
    assert.equal(unidadeParaPedido({ unidade_medida: 'kg', fator_embalagem: 12, embalagem: '' }), 'un');
    assert.equal(unidadeParaPedido({ unidade_medida: 'l', fator_embalagem: 5 }), 'un');
    assert.equal(unidadeParaPedido({ unidade_medida: 'm', fator_embalagem: 10 }), 'un');
    assert.equal(unidadeParaPedido({ unidade_medida: 'kg', fator_embalagem: 1 }), 'kg');
    assert.equal(unidadeParaPedido({ unidade_medida: 'un', embalagem: '5 L' }), 'un');
    assert.equal(unidadeParaPedido({ unidade_medida: 'kg', embalagem: '' }), 'kg');
  });

  it('marca linha confusa so quando unidade continua ainda nao virou un', () => {
    assert.equal(pedidoItemUnidadeConfusa({ unidade_medida: 'kg', embalagem: 'PCT 2 kg' }), true);
    assert.equal(pedidoItemUnidadeConfusa({ unidade_medida: 'kg', fator_embalagem: 1 }), false);
    assert.equal(pedidoItemUnidadeConfusa({ unidade_medida: 'un', embalagem: 'PCT 2 kg' }), false);
  });

  it('sanitiza variantes de unidade para o codigo padrao', () => {
    assert.equal(sanitizarUnidadeMedida('KG'), 'kg');
    assert.equal(sanitizarUnidadeMedida('und'), 'un');
    assert.equal(sanitizarUnidadeMedida('quilo'), 'kg');
    assert.equal(sanitizarUnidadeMedida('pacote'), 'pct');
    assert.equal(sanitizarUnidadeMedida('caixa'), 'cx');
    assert.equal(sanitizarUnidadeMedida(''), '');
  });

  it('aceita so numero na quantidade da embalagem', () => {
    assert.equal(digitarQuantidadeEmbalagem('12abc'), '12');
    assert.equal(digitarQuantidadeEmbalagem('12,5x'), '12,5');
    assert.equal(digitarQuantidadeEmbalagem('abc'), '');
  });
});
