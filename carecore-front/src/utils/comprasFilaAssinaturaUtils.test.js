import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agruparFilaAssinaturaPorUnidade,
  chaveUnidadeFila,
  dataReferenciaFila,
  nomeUnidadeFila,
} from './comprasFilaAssinaturaUtils.js';

describe('chave e nome da unidade na fila', () => {
  it('usa o projeto quando há instituição', () => {
    const pedido = { instituicao_id: 'u1', instituicao_nome: 'CEEI Liberdade' };
    assert.equal(chaveUnidadeFila(pedido), 'u1');
    assert.equal(nomeUnidadeFila(pedido), 'CEEI Liberdade');
  });

  it('marca Sede quando o escopo é da sede sem projeto', () => {
    const pedido = { escopo_unidade: 'sede', instituicao_id: null };
    assert.equal(chaveUnidadeFila(pedido), 'sede');
    assert.equal(nomeUnidadeFila(pedido), 'Sede');
  });
});

describe('agruparFilaAssinaturaPorUnidade', () => {
  it('agrupa contratos e orçamentos do mesmo projeto', () => {
    const grupos = agruparFilaAssinaturaPorUnidade(
      [
        {
          id: 'p1',
          instituicao_id: 'u1',
          instituicao_nome: 'CEEI Vila Gustavo',
          tipo: 'servico',
          atualizado_em: '2026-10-23 10:00:00',
        },
        {
          id: 'p2',
          instituicao_id: 'u2',
          instituicao_nome: 'CEEI Liberdade',
          tipo: 'imobilizado',
          atualizado_em: '2026-10-22 09:00:00',
        },
      ],
      [
        {
          id: 'p3',
          instituicao_id: 'u1',
          instituicao_nome: 'CEEI Vila Gustavo',
          tipo: 'servico',
          atualizado_em: '2026-10-23 15:30:00',
          contrato: { id: 'c1' },
        },
      ],
    );
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].nome, 'CEEI Liberdade');
    assert.equal(grupos[1].nome, 'CEEI Vila Gustavo');
    assert.equal(grupos[1].qtd, 2);
    assert.equal(grupos[1].atualizado, '2026-10-23 15:30:00');
    assert.equal(grupos[1].itens[0]._filaKind, 'contrato');
  });

  it('usa submetido_em quando não há atualizado_em', () => {
    assert.equal(
      dataReferenciaFila({ submetido_em: '2026-10-20 08:15:00' }),
      '2026-10-20 08:15:00',
    );
  });
});
