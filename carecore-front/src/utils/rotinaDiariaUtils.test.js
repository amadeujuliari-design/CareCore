import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  exigeJustificativaRetornoRapidoRotina,
  filtrarContagensInteracaoSemAlimentacao,
  obterCodigoCarteirinhaConvivente,
  obterProximaInteracaoPar,
  obterRotuloBotaoInteracao,
  perfilOcultaSomatoriaAlimentacao,
  totalInteracoesSemAlimentacao,
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

  it('oculta somatoria de alimentacao para orientador e tecnico', () => {
    assert.equal(perfilOcultaSomatoriaAlimentacao('Orientador'), true);
    assert.equal(perfilOcultaSomatoriaAlimentacao('Técnico'), true);
    assert.equal(perfilOcultaSomatoriaAlimentacao('Gestor'), false);
  });

  it('remove refeicoes das contagens visiveis para perfis operacionais', () => {
    const contagens = {
      Jantar: 10,
      Banho: 3,
      'Café da manhã': 2,
    };

    assert.deepEqual(filtrarContagensInteracaoSemAlimentacao(contagens), { Banho: 3 });
    assert.equal(totalInteracoesSemAlimentacao(contagens), 3);
  });

  it('sugere entrega de cobertor apos retirada', () => {
    const resumoHoje = {
      pessoa1: {
        ultimas_interacoes: {
          Cobertor: { tipo_registro: 'Retirada de Cobertor' },
        },
      },
    };

    assert.equal(
      obterProximaInteracaoPar(resumoHoje, 'pessoa1', 'Cobertor'),
      'Entrega de Cobertor',
    );
    assert.equal(
      obterRotuloBotaoInteracao(resumoHoje, 'pessoa1', 'Cobertor'),
      'Entregar cobertor',
    );
  });

  it('usa presencas do dia como fallback para sugerir proxima interacao', () => {
    const resumoHoje = {
      pessoa1: {
        presencas: [
          { tipo_registro: 'Retirada de Cobertor', data_registro: '2026-06-29T12:26:00' },
        ],
      },
    };

    assert.equal(
      obterProximaInteracaoPar(resumoHoje, 'pessoa1', 'Cobertor'),
      'Entrega de Cobertor',
    );
  });
});
