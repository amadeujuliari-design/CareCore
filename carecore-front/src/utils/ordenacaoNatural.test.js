import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarPorTextoNatural, ordenarQuartosComLeitos } from './ordenacaoNatural.js';

test('ordenarPorTextoNatural ordena quartos alfanumericamente', () => {
  const quartos = [
    { nome: 'Quarto 10' },
    { nome: 'Quarto 2' },
    { nome: 'Ala B' },
    { nome: 'Ala A' },
    { nome: 'Quarto 1' },
  ];

  const ordenados = ordenarPorTextoNatural(quartos, (quarto) => quarto.nome);
  assert.deepEqual(ordenados.map((quarto) => quarto.nome), [
    'Ala A',
    'Ala B',
    'Quarto 1',
    'Quarto 2',
    'Quarto 10',
  ]);
});

test('ordenarQuartosComLeitos ordena leitos por numero', () => {
  const quartos = [{
    nome: 'Quarto 1',
    leitos: [
      { identificacao: 'Cama 10' },
      { identificacao: 'Cama 2' },
      { identificacao: 'Cama 1' },
    ],
  }];

  const ordenados = ordenarQuartosComLeitos(quartos);
  assert.deepEqual(
    ordenados[0].leitos.map((leito) => leito.identificacao),
    ['Cama 1', 'Cama 2', 'Cama 10'],
  );
});
