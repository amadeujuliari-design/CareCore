import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agruparDocumentosAnexadosPedido,
  documentosAnexadosDoPedido,
} from './comprasDocumentosAnexadosUtils.js';

describe('documentosAnexadosDoPedido', () => {
  it('junta NF, boleto, comprovante e relacionado sem duplicar anexo da NF', () => {
    const itens = documentosAnexadosDoPedido({
      anexos: [
        { id: 'a-nf', nome_arquivo: 'nf.pdf', classe_documento: 'nota_fiscal', parcela_numero: 1 },
        { id: 'a-bol', nome_arquivo: 'boleto.pdf', classe_documento: 'boleto', parcela_numero: 1 },
        { id: 'a-comp', nome_arquivo: 'pix.png', classe_documento: 'comprovante', parcela_numero: 2 },
        { id: 'a-rel', nome_arquivo: 'contrato-extra.pdf', classe_documento: 'relacionado' },
        { id: 'a-orc', nome_arquivo: 'orcamento.pdf', classe_documento: null, tipo: 'orcamento' },
      ],
      notas_fiscais: [
        {
          id: 'nf1',
          anexo_id: 'a-nf',
          tipo_nf: 'servico',
          numero: '454',
          valor_centavos: 50000,
          parcela_numero: 1,
        },
      ],
    });
    assert.equal(itens.length, 4);
    assert.equal(itens[0].classe, 'nota_fiscal');
    assert.equal(itens[0].numero, '454');
    assert.equal(itens.filter((i) => i.anexoId === 'a-nf').length, 1);
    assert.equal(itens.find((i) => i.classe === 'boleto').parcela, 1);
    assert.equal(itens.find((i) => i.classe === 'comprovante').parcela, 2);
    assert.equal(itens.find((i) => i.classe === 'relacionado').parcela, 0);
  });
});

describe('agruparDocumentosAnexadosPedido', () => {
  it('no parcelado junta os arquivos da mesma parcela', () => {
    const grupos = agruparDocumentosAnexadosPedido({
      pagamento_qtd_parcelas: 4,
      anexos: [
        { id: 'a-nf', nome_arquivo: 'nf.pdf', classe_documento: 'nota_fiscal', parcela_numero: 1 },
        { id: 'a-comp', nome_arquivo: 'pix.png', classe_documento: 'comprovante', parcela_numero: 1 },
        { id: 'a-rel', nome_arquivo: 'outro.pdf', classe_documento: 'relacionado' },
      ],
      notas_fiscais: [
        { id: 'nf1', anexo_id: 'a-nf', tipo_nf: 'produto', numero: '10', parcela_numero: 1 },
      ],
    });
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].titulo, 'Parcela 1');
    assert.equal(grupos[0].itens.length, 2);
    assert.deepEqual(grupos[0].itens.map((i) => i.classe), ['nota_fiscal', 'comprovante']);
    assert.equal(grupos[1].titulo, 'Arquivos do processo');
    assert.equal(grupos[1].itens[0].classe, 'relacionado');
  });

  it('à vista devolve uma lista só, sem título de parcela', () => {
    const grupos = agruparDocumentosAnexadosPedido({
      pagamento_qtd_parcelas: 1,
      anexos: [{ id: 'a1', nome_arquivo: 'nf.pdf', classe_documento: 'nota_fiscal', parcela_numero: 1 }],
      notas_fiscais: [{ id: 'nf1', anexo_id: 'a1', tipo_nf: 'produto', numero: '1', parcela_numero: 1 }],
    });
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].titulo, null);
    assert.equal(grupos[0].itens.length, 1);
  });
});
