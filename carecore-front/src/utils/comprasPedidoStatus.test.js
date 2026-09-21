import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  progressoOrcamentosTexto,
  rotuloStatusPedidoLista,
  varianteBadgeStatusPedido,
} from './comprasPedidoStatus.js';

describe('comprasPedidoStatus', () => {
  it('status sem n/3 (contador só na coluna Orçamentos)', () => {
    assert.equal(
      rotuloStatusPedidoLista({ status: 'em_cotacao', orcamentos_com_anexo: 0 }),
      'Em cotação · aguardando retorno',
    );
    assert.equal(
      rotuloStatusPedidoLista({ status: 'em_cotacao', orcamentos_com_anexo: 2 }),
      'Em cotação',
    );
    assert.equal(
      rotuloStatusPedidoLista({ status: 'aguardando_escolha_orcamento', orcamentos_com_anexo: 3 }),
      'Pronto para escolher',
    );
  });

  it('usa badge info quando pronto para escolher', () => {
    assert.equal(varianteBadgeStatusPedido('aguardando_escolha_orcamento'), 'info');
    assert.equal(varianteBadgeStatusPedido('em_cotacao'), 'warning');
  });

  it('esconde progresso n/3 depois da cotação', () => {
    assert.equal(progressoOrcamentosTexto({ status: 'em_cotacao', orcamentos_com_anexo: 1 }), '1/3');
    assert.equal(progressoOrcamentosTexto({ status: 'enviado_fornecedor', orcamentos_com_anexo: 3 }), null);
    assert.equal(progressoOrcamentosTexto({ status: 'aprovado', orcamentos_com_anexo: 3 }), null);
    assert.equal(
      rotuloStatusPedidoLista({ status: 'enviado_fornecedor', orcamentos_com_anexo: 3 }),
      'Enviado ao fornecedor',
    );
  });
});
