import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { montarLinhasEconomia } from './comprasEconomiaExportPrint.js';

describe('montarLinhasEconomia', () => {
  it('coloca o total do projeto e o detalhe de cada pedido', () => {
    const linhas = montarLinhasEconomia([
      {
        nome: 'CAE I CENTRO',
        total_cheio_centavos: 150000,
        total_escolhida_centavos: 120000,
        economia_vs_maior_centavos: 30000,
        economia_vs_media_centavos: 10000,
        linhas: [
          {
            titulo: 'Material de limpeza',
            competencia: '2026-10',
            data_referencia: '2026-10-16',
            tipo_rotulo: 'Itens de consumo',
            valor_cheio_centavos: 150000,
            valor_escolhida_centavos: 120000,
            economia_vs_maior_centavos: 30000,
            economia_vs_media_centavos: 10000,
          },
        ],
      },
    ]);
    assert.equal(linhas.length, 2);
    assert.equal(linhas[0].Linha, 'Total do projeto');
    assert.equal(linhas[0].Projeto, 'CAE I CENTRO');
    assert.equal(linhas[0]['Valor cheio'], 'R$\u00a01.500,00');
    assert.equal(linhas[1].Linha, 'Pedido');
    assert.equal(linhas[1].Pedido, 'Material de limpeza');
    assert.equal(linhas[1].Data, '16/10/2026');
    assert.equal(linhas[1].Tipo, 'Itens de consumo');
    assert.equal(linhas[1]['Economia vs maior'], 'R$\u00a0300,00');
  });
});
