export const NFP_CADASTRO_PAGE_SIZE = 50;

export function normalizarListaPaginadaNfp(data, { limite = NFP_CADASTRO_PAGE_SIZE, offset = 0 } = {}) {
  if (Array.isArray(data)) {
    return {
      itens: data,
      paginacao: {
        total: data.length,
        limite,
        offset,
        pagina: 1,
        total_paginas: 1,
      },
    };
  }
  const itens = Array.isArray(data?.itens) ? data.itens : [];
  const pag = data?.paginacao || {};
  const total = Number(pag.total ?? data?.total ?? itens.length) || 0;
  const limiteN = Number(pag.limite ?? limite) || limite;
  const offsetN = Number(pag.offset ?? offset) || 0;
  return {
    itens,
    paginacao: {
      total,
      limite: limiteN,
      offset: offsetN,
      pagina: Number(pag.pagina) || Math.floor(offsetN / Math.max(limiteN, 1)) + 1,
      total_paginas: Number(pag.total_paginas) || Math.max(1, Math.ceil(total / Math.max(limiteN, 1))),
    },
  };
}
