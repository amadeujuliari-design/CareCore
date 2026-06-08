import { useMemo } from 'react';

import {
  compararConviventesPorBusca,
  conviventeCorrespondeBusca,
} from '../utils/conviventeBuscaUtils.js';
import { statusNaoAtivo } from '../utils/conviventesProntuarioUtils.js';

export const CONVIVENTES_POR_PAGINA = 20;

function conviventeCorrespondePesquisa(convivente, termoPesquisa) {
  const termo = termoPesquisa.toLowerCase().trim();

  if (termo.startsWith('#')) {
    const termoNumerico = termo.replace(/\D/g, '');
    const prontuario = convivente.numero_institucional ? String(convivente.numero_institucional) : '';
    return Boolean(termoNumerico && prontuario === termoNumerico);
  }

  return conviventeCorrespondeBusca(convivente, termoPesquisa);
}

function conviventeCorrespondeStatus(convivente, filtroStatus) {
  return (
    filtroStatus === 'Todos' ||
    (filtroStatus === 'Inativos'
      ? statusNaoAtivo(convivente.status)
      : convivente.status === filtroStatus)
  );
}

function conviventeCorrespondeLeito(convivente, filtroLeito) {
  if (filtroLeito === 'Com Cama') return convivente.leito_id !== null;
  if (filtroLeito === 'Sem Cama') return convivente.leito_id === null;
  return true;
}

function ordenarConviventes(a, b, termoPesquisa, idUsuarioLogado) {
  const isMeuCasoA = a.tecnico_id === idUsuarioLogado;
  const isMeuCasoB = b.tecnico_id === idUsuarioLogado;

  if (isMeuCasoA && !isMeuCasoB) return -1;
  if (!isMeuCasoA && isMeuCasoB) return 1;

  return compararConviventesPorBusca(a, b, termoPesquisa);
}

export function filtrarOrdenarConviventes({
  conviventes,
  termoPesquisa,
  filtroStatus,
  filtroLeito,
  idUsuarioLogado,
}) {
  return conviventes
    .filter((convivente) => (
      conviventeCorrespondePesquisa(convivente, termoPesquisa) &&
      conviventeCorrespondeStatus(convivente, filtroStatus) &&
      conviventeCorrespondeLeito(convivente, filtroLeito)
    ))
    .sort((a, b) => ordenarConviventes(a, b, termoPesquisa, idUsuarioLogado));
}

export function paginarConviventes(conviventesFiltrados, paginaConviventes) {
  const totalPaginasConviventes = Math.max(
    1,
    Math.ceil(conviventesFiltrados.length / CONVIVENTES_POR_PAGINA),
  );
  const paginaConviventesSegura = Math.min(paginaConviventes, totalPaginasConviventes);
  const indiceInicialConviventes = (paginaConviventesSegura - 1) * CONVIVENTES_POR_PAGINA;
  const indiceFinalConviventes = indiceInicialConviventes + CONVIVENTES_POR_PAGINA;

  return {
    conviventesVisiveis: conviventesFiltrados.slice(indiceInicialConviventes, indiceFinalConviventes),
    indiceInicialConviventes,
    indiceFinalConviventes,
    paginaConviventesSegura,
    totalPaginasConviventes,
  };
}

export function useConviventesLista({
  conviventes,
  termoPesquisa,
  filtroStatus,
  filtroLeito,
  paginaConviventes,
  setPaginaConviventes,
  idUsuarioLogado,
}) {
  const conviventesFiltrados = useMemo(
    () => filtrarOrdenarConviventes({
      conviventes,
      termoPesquisa,
      filtroStatus,
      filtroLeito,
      idUsuarioLogado,
    }),
    [conviventes, filtroLeito, filtroStatus, idUsuarioLogado, termoPesquisa],
  );

  const {
    conviventesVisiveis,
    indiceInicialConviventes,
    indiceFinalConviventes,
    paginaConviventesSegura,
    totalPaginasConviventes,
  } = paginarConviventes(conviventesFiltrados, paginaConviventes);

  const conviventesVisiveisMemorizados = useMemo(
    () => conviventesVisiveis,
    [conviventesVisiveis],
  );

  const irParaPaginaConviventes = (novaPagina) => {
    setPaginaConviventes(Math.min(Math.max(novaPagina, 1), totalPaginasConviventes));
  };

  return {
    conviventesFiltrados,
    conviventesVisiveis: conviventesVisiveisMemorizados,
    exibindoApenasAtivos: filtroStatus === 'Ativo',
    indiceInicialConviventes,
    indiceFinalConviventes,
    paginaConviventesSegura,
    totalPaginasConviventes,
    irParaPaginaConviventes,
  };
}
