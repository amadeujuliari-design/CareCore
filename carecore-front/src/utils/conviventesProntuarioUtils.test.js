import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agruparEvolucoesPiaPorRegistro,
  criarEstadoInicialConvivente,
  dataLocalISO,
  montarFormEvolucaoPia,
  montarPayloadProntuario,
  ordenarRegistrosPiaPrincipais,
  validarCampoProntuario,
  validarProntuarioAntesSalvar,
} from './conviventesProntuarioUtils.js';

describe('conviventesProntuarioUtils', () => {
  it('cria estado inicial com data local formatada', () => {
    assert.equal(dataLocalISO(new Date(2026, 5, 4)), '2026-06-04');

    const estado = criarEstadoInicialConvivente();

    assert.equal(estado.status, 'Ativo');
    assert.equal(estado.nome_completo, '');
    assert.equal(estado.possui_renda, false);
  });

  it('monta payload removendo campos auxiliares e convertendo vazios em null', () => {
    const payload = montarPayloadProntuario(
      {
        nome_completo: 'Pessoa Teste',
        status: 'Bloqueado',
        motivo_status: 'Evasão',
        relato_status: 'Saiu sem autorização',
        complemento: '',
      },
      'Ativo',
    );

    assert.deepEqual(payload, {
      nome_completo: 'Pessoa Teste',
      status: 'Bloqueado',
      observacao_status: '[EVASÃO] - Saiu sem autorização',
      complemento: null,
    });
  });

  it('valida campos e bloqueia prontuario inconsistente', () => {
    assert.equal(validarCampoProntuario('cpf', '111.111.111-11'), 'CPF INVÁLIDO');
    assert.equal(validarCampoProntuario('email_pessoal', 'email-invalido'), 'DIGITE UM E-MAIL VÁLIDO');
    assert.equal(validarCampoProntuario('cep', '12345-678'), '');

    const validacao = validarProntuarioAntesSalvar(
      {
        nome_completo: 'Pessoa Teste',
        status: 'Bloqueado',
        motivo_status: '',
        relato_status: '',
      },
      'Ativo',
      {},
    );

    assert.equal(validacao.valido, false);
    assert.match(validacao.mensagem, /Suspensão provisória/i);
  });

  it('prepara e ordena estruturas do PIA', () => {
    const principalAntigo = { id: 'pia-1', data_registro: '2026-01-01T10:00:00Z' };
    const principalRecente = { id: 'pia-2', data_registro: '2026-02-01T10:00:00Z', status: 'Concluído' };
    const evolucaoA = { id: 'evo-1', registro_pai_id: 'pia-1', data_registro: '2026-01-03T10:00:00Z' };
    const evolucaoB = { id: 'evo-2', registro_pai_id: 'pia-1', data_registro: '2026-01-02T10:00:00Z' };

    assert.equal(ordenarRegistrosPiaPrincipais([principalAntigo, evolucaoA, principalRecente])[0], principalRecente);
    assert.deepEqual(agruparEvolucoesPiaPorRegistro([principalAntigo, evolucaoA, evolucaoB])['pia-1'], [evolucaoB, evolucaoA]);
    assert.deepEqual({
      registro_pai_id: montarFormEvolucaoPia(principalRecente).registro_pai_id,
      tipo_registro: montarFormEvolucaoPia(principalRecente).tipo_registro,
      titulo: montarFormEvolucaoPia(principalRecente).titulo,
      status: montarFormEvolucaoPia(principalRecente).status,
    }, {
      registro_pai_id: 'pia-2',
      tipo_registro: 'Evolução',
      titulo: 'Evolução',
      status: 'Concluído',
    });
  });
});
