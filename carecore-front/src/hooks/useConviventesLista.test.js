import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filtrarOrdenarConviventes,
  paginarConviventes,
} from './useConviventesLista.js';

const conviventes = [
  {
    id: '1',
    nome_completo: 'Carlos Silva',
    nome_social: '',
    numero_institucional: 200,
    cpf: '111.222.333-44',
    status: 'Ativo',
    leito_id: null,
    tecnico_id: 'tecnico-2',
  },
  {
    id: '2',
    nome_completo: 'Ana Souza',
    nome_social: '',
    numero_institucional: 100,
    cpf: '555.666.777-88',
    status: 'Ativo',
    leito_id: 'leito-1',
    tecnico_id: 'tecnico-1',
  },
  {
    id: '3',
    nome_completo: 'Bruno Lima',
    nome_social: '',
    numero_institucional: 300,
    cpf: '999.888.777-66',
    status: 'Inativo',
    leito_id: null,
    tecnico_id: 'tecnico-3',
  },
];

function filtrar(overrides = {}) {
  return filtrarOrdenarConviventes({
    conviventes,
    termoPesquisa: '',
    filtroStatus: 'Todos',
    filtroLeito: 'Todos',
    idUsuarioLogado: 'tecnico-1',
    ...overrides,
  });
}

describe('useConviventesLista helpers', () => {
  it('prioriza conviventes do tecnico logado e ordena os demais por nome', () => {
    assert.deepEqual(filtrar().map((convivente) => convivente.id), ['2', '3', '1']);
  });

  it('filtra por prontuario exato quando pesquisa inicia com #', () => {
    const resultado = filtrar({ termoPesquisa: '#200' });

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, '1');
  });

  it('filtra por status e leito', () => {
    const resultado = filtrar({
      filtroStatus: 'Ativo',
      filtroLeito: 'Com Cama',
    });

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, '2');
  });

  it('filtra conviventes em ausencia justificada', () => {
    const resultado = filtrar({
      conviventes: [
        ...conviventes,
        {
          id: '4',
          nome_completo: 'Daniel Rocha',
          nome_social: '',
          numero_institucional: 400,
          cpf: '',
          status: 'Ausência justificada',
          leito_id: null,
          tecnico_id: 'tecnico-4',
        },
      ],
      filtroStatus: 'Ausência justificada',
    });

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, '4');
  });

  it('calcula paginacao com limites seguros', () => {
    const lista = Array.from({ length: 25 }, (_, index) => ({ id: String(index + 1) }));

    const primeiraPagina = paginarConviventes(lista, 1);
    const paginaExcedente = paginarConviventes(lista, 99);

    assert.equal(primeiraPagina.conviventesVisiveis.length, 20);
    assert.equal(primeiraPagina.totalPaginasConviventes, 2);
    assert.equal(paginaExcedente.paginaConviventesSegura, 2);
    assert.equal(paginaExcedente.conviventesVisiveis.length, 5);
  });
});
