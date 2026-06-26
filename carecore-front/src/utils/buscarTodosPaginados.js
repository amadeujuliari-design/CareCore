function extrairItens(resultado) {
  if (Array.isArray(resultado)) return resultado;
  return resultado?.items || resultado?.registros || [];
}

function extrairTotal(resultado, fallback = 0) {
  if (Array.isArray(resultado)) return resultado.length;
  return Number(resultado?.total ?? fallback);
}

/**
 * Busca todas as páginas de uma listagem paginada (impressão/exportação).
 * `buscarPagina` deve retornar { items|registros, total, has_more? } ou array.
 */
export async function buscarTodosItensPaginados({
  buscarPagina,
  limitePagina = 100,
  maxRegistros = 10000,
}) {
  const acumulado = [];
  let offset = 0;

  while (acumulado.length < maxRegistros) {
    const resultado = await buscarPagina({ limite: limitePagina, offset });
    const itens = extrairItens(resultado);

    if (!itens.length) break;

    acumulado.push(...itens);

    const total = extrairTotal(resultado, acumulado.length);
    const hasMore = resultado?.has_more ?? (acumulado.length < total);

    if (!hasMore || acumulado.length >= total) break;
    offset += itens.length;
  }

  return acumulado.slice(0, maxRegistros);
}
