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

  it('rótulos e cores distintas da emergência', () => {
    assert.equal(rotuloStatusPedidoLista({ status: 'aguardando_nf' }), 'Aguardando NF');
    assert.equal(rotuloStatusPedidoLista({ status: 'aguardando_assinatura_nf' }), 'Aguardando assinatura da NF');
    assert.equal(rotuloStatusPedidoLista({ status: 'aguardando_pagamento' }), 'Aguardando pagamento');
    assert.equal(
      rotuloStatusPedidoLista({ status: 'aguardando_conferencia_extrato' }),
      'Aguardando conferência do extrato',
    );
    assert.equal(varianteBadgeStatusPedido('aguardando_nf'), 'cyan');
    assert.equal(varianteBadgeStatusPedido('aguardando_assinatura_nf'), 'fuchsia');
    assert.equal(varianteBadgeStatusPedido('aguardando_pagamento'), 'orange');
    assert.equal(varianteBadgeStatusPedido('aguardando_conferencia_extrato'), 'lime');
  });

  it('rótulo Imprimir NF', () => {
    assert.equal(rotuloStatusPedidoLista({ status: 'imprimir_nf' }), 'Imprimir NF');
    assert.equal(varianteBadgeStatusPedido('imprimir_nf'), 'sky');
  });

  it('mesmo status sempre a mesma cor', () => {
    const mapa = {
      rascunho: 'default',
      aguardando_nf: 'cyan',
      aguardando_assinatura_nf: 'fuchsia',
      aguardando_cotacao: 'warning',
      em_cotacao: 'warning',
      aguardando_escolha_orcamento: 'info',
      aguardando_aprovacao_unidade: 'purple',
      aguardando_aprovacao_sede: 'indigo',
      aprovado: 'success',
      enviado_fornecedor: 'teal',
      aguardando_pagamento: 'orange',
      aguardando_conferencia_extrato: 'lime',
      imprimir_nf: 'sky',
      recebido: 'success',
      cancelado: 'danger',
      reprovado: 'danger',
    };
    for (const [status, variante] of Object.entries(mapa)) {
      assert.equal(varianteBadgeStatusPedido(status), variante, status);
    }
  });
});
