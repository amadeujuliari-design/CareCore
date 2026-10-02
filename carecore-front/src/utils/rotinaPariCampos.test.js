import test from 'node:test';
import assert from 'node:assert/strict';

import {
  diasDaEscala,
  escalaDosDias,
  textoRotinaLista,
} from './rotinaPariCampos.js';

test('segunda a sexta marca os cinco dias', () => {
  assert.deepEqual(diasDaEscala('seg-sex'), ['seg', 'ter', 'qua', 'qui', 'sex']);
});

test('desmarcar um dia da escala fixa vira dias específicos', () => {
  assert.equal(escalaDosDias(['seg', 'ter', 'qua', 'qui'], 'seg-sex'), 'dias');
});

test('6x1 permanece ao marcar um dia', () => {
  assert.equal(escalaDosDias(['seg'], '6x1'), '6x1');
});

test('lista mostra ocupação, escala e aviso que sobrou', () => {
  const texto = textoRotinaLista({
    ocupacao_trabalho: 'SERVENTE DE PEDREIRO',
    escala_trabalho: 'seg-sex',
    dias_trabalho: 'seg,ter,qua,qui,sex',
    parcerias: 'Cozinha escola; Educação financeira',
    etapa_escolar: 'concluido',
    observacao_operacional: 'Não está na lista de refeição',
  });
  assert.match(texto, /Trabalho \/ ocupação: SERVENTE DE PEDREIRO/);
  assert.match(texto, /Escala: Segunda a sexta/);
  assert.match(texto, /Parcerias: Cozinha escola/);
  assert.match(texto, /Escolar: Concluído/);
  assert.match(texto, /Avisos\/Alertas: Não está na lista de refeição/);
});
