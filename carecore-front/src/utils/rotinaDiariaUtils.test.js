import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  exigeJustificativaRetornoRapidoRotina,
  obterCodigoCarteirinhaConvivente,
} from './rotinaDiariaUtils.js';

describe('rotinaDiariaUtils', () => {
  it('exige justificativa para entrada em menos de 10 minutos após saída', () => {
    const resumoHoje = {
      pessoa1: {
        ultimo_movimento: 'Saída',
        ultimo_movimento_data: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    };

    assert.equal(exigeJustificativaRetornoRapidoRotina(resumoHoje, 'pessoa1', 'Entrada'), true);
  });

  it('exige justificativa para saída em menos de 10 minutos após entrada', () => {
    const resumoHoje = {
      pessoa1: {
        ultimo_movimento: 'Entrada',
        ultimo_movimento_data: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    };

    assert.equal(exigeJustificativaRetornoRapidoRotina(resumoHoje, 'pessoa1', 'Saída'), true);
  });

  it('nao exige justificativa para movimento depois de 10 minutos', () => {
    const resumoHoje = {
      pessoa1: {
        ultimo_movimento: 'Saída',
        ultimo_movimento_data: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      },
    };

    assert.equal(exigeJustificativaRetornoRapidoRotina(resumoHoje, 'pessoa1', 'Entrada'), false);
  });

  it('gera codigo da carteirinha com o mesmo identificador lido na rotina', () => {
    assert.equal(obterCodigoCarteirinhaConvivente({ numero_institucional: 123 }), '123');
    assert.equal(obterCodigoCarteirinhaConvivente({ cpf: '123.456.789-00' }), '12345678900');
    assert.equal(obterCodigoCarteirinhaConvivente({ id: 'abcdefghi' }), 'abcdefgh');
  });
});
