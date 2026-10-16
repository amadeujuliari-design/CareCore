import test from 'node:test';
import assert from 'node:assert/strict';

import {
  menuOcultoNoProjeto,
  projetoEhReencontroPari,
  projetoEhSedeAeb,
  projetoSemFluxoPortaria,
  projetoTemCustomizacaoOperacional,
} from './projetoPari.js';

test('modelo do PARI vale para Anhangabaú, Cruzeiro do Sul e Jabaquara', () => {
  assert.equal(projetoEhReencontroPari('REENCONTRO PARI'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO ANHANGABAÚ'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO CRUZEIRO DO SUL'), true);
  assert.equal(projetoEhReencontroPari('REENCONTRO JABAQUARA'), true);
  assert.equal(projetoEhReencontroPari('CASA PORTO'), false);
  assert.equal(projetoSemFluxoPortaria('REENCONTRO JABAQUARA'), false);
  assert.equal(projetoSemFluxoPortaria('REENCONTRO PARI'), true);
  assert.equal(projetoSemFluxoPortaria('REENCONTRO CRUZEIRO DO SUL'), true);
});

test('sede e projeto sem customização escondem rotina, atividades e convênio', () => {
  assert.equal(projetoEhSedeAeb('SEDE AEB'), true);
  assert.equal(projetoTemCustomizacaoOperacional('SIAT II ARMÊNIA'), true);
  assert.equal(projetoTemCustomizacaoOperacional('CASA PORTO SEGURO'), true);
  assert.equal(projetoTemCustomizacaoOperacional('CEI BELÉM'), false);

  assert.equal(menuOcultoNoProjeto('/rotina/lavanderia', 'SEDE AEB'), true);
  assert.equal(menuOcultoNoProjeto('/atividades/chamada', 'CAE I CENTRO'), true);
  assert.equal(menuOcultoNoProjeto('/rotina', 'CAE I CENTRO'), false);
  assert.equal(menuOcultoNoProjeto('/rotina/historico', 'CAE I CENTRO'), false);
  assert.equal(menuOcultoNoProjeto('/rotina/lavanderia', 'CAE I CENTRO'), true);
  assert.equal(menuOcultoNoProjeto('/convenio-sisa', 'CAE I CENTRO'), true);
  assert.equal(projetoSemFluxoPortaria('CAE I CENTRO'), true);
  assert.equal(menuOcultoNoProjeto('/convenio-sisa', 'CEI BELÉM'), true);
  assert.equal(menuOcultoNoProjeto('/conviventes', 'SEDE AEB'), true);
  assert.equal(menuOcultoNoProjeto('/quartos', 'SEDE AEB'), true);
  assert.equal(menuOcultoNoProjeto('/conviventes', 'CAE I CENTRO'), false);
  assert.equal(menuOcultoNoProjeto('/quartos', 'CEI BELÉM'), false);
  assert.equal(menuOcultoNoProjeto('/rotina', 'SIAT II ARMÊNIA'), false);
  assert.equal(menuOcultoNoProjeto('/atividades', 'REENCONTRO PARÍ'), false);
  assert.equal(menuOcultoNoProjeto('/convenio-sisa', 'CASA PORTO SEGURO'), false);
  assert.equal(menuOcultoNoProjeto('/dashboard', 'SEDE AEB'), false);
});
