import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JANELA_IGNORAR_LEITURA_REPETIDA_MS,
  deveIgnorarCupomNfpJaTratado,
  deveIgnorarLeituraCodigoRepetida,
  deveIgnorarLeituraConviventeRepetida,
  extrairChaveNfpDeLeitura,
  registrarCupomNfpTratado,
} from './leituraCodigoUtils.js';

describe('leituraCodigoUtils', () => {
  it('ignora o mesmo codigo dentro da janela de 7 segundos', () => {
    const ref = { current: { codigo: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, ' 123 '), false);
    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '123'), true);
  });

  it('permite codigo diferente na sequencia dentro da janela', () => {
    const ref = { current: { codigo: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '111'), false);
    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '222'), false);
  });

  it('libera o mesmo codigo apos a janela expirar', () => {
    const ref = {
      current: {
        codigo: '999',
        horario: Date.now() - JANELA_IGNORAR_LEITURA_REPETIDA_MS - 1,
      },
    };

    assert.equal(deveIgnorarLeituraCodigoRepetida(ref, '999'), false);
  });

  it('ignora o mesmo convivente dentro da janela e libera outro na sequencia', () => {
    const ref = { current: { conviventeId: '', horario: 0 } };

    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-a'), false);
    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-a'), true);
    assert.equal(deveIgnorarLeituraConviventeRepetida(ref, 'conv-b'), false);
  });

  it('extrai chave 44 de URL SEFAZ e de digitos', () => {
    const chave = '35260847508411169495651090002701871160307536';
    assert.equal(
      extrairChaveNfpDeLeitura(`https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chave}|2|1|1`),
      chave,
    );
    assert.equal(extrairChaveNfpDeLeitura(` ${chave} `), chave);
  });

  it('ignora cupom NFP ja tratado na sessao (sucesso ou 409)', () => {
    const ref = { current: new Set() };
    const chave = '35260847508411169495651090002701871160307536';
    const url = `https://exemplo/?p=${chave}|2|1`;

    assert.equal(deveIgnorarCupomNfpJaTratado(ref, url), false);
    registrarCupomNfpTratado(ref, chave);
    assert.equal(deveIgnorarCupomNfpJaTratado(ref, url), true);
    assert.equal(deveIgnorarCupomNfpJaTratado(ref, chave), true);
    assert.equal(
      deveIgnorarCupomNfpJaTratado(ref, '35260847508411169495651090002701871160307537'),
      false,
    );
  });
});
