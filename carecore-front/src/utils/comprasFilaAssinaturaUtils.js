import { rotuloTipoPedido } from './comprasPedidoTipos.js';

export function chaveUnidadeFila(pedido) {
  if (pedido?.escopo_unidade === 'sede' && !pedido?.instituicao_id) return 'sede';
  return String(pedido?.instituicao_id || pedido?.instituicao_nome || 'sem-unidade');
}

export function nomeUnidadeFila(pedido) {
  if (pedido?.escopo_unidade === 'sede' && !pedido?.instituicao_id) return 'Sede';
  return pedido?.instituicao_nome || pedido?.instituicao_id || 'Sem unidade';
}

export function dataReferenciaFila(pedido) {
  return (
    pedido?.atualizado_em
    || pedido?.submetido_em
    || pedido?.aprovado_unidade_em
    || pedido?.criado_em
    || pedido?.contrato?.criado_em
    || ''
  );
}

/** Menor data de pagamento das NFs do pedido (AAAA-MM-DD). */
export function dataPagamentoFilaAPagar(pedido) {
  const datas = (pedido?.notas_fiscais || [])
    .filter((n) => n?.data_pagamento && n.tipo_nf !== 'boleto')
    .map((n) => String(n.data_pagamento).slice(0, 10))
    .filter(Boolean)
    .sort();
  return datas[0] || '';
}

/**
 * Ordena A pagar: vencidos e hoje primeiro (data crescente),
 * depois futuros; no empate, não lidos antes.
 */
export function compararPedidosFilaAPagar(a, b) {
  const da = dataPagamentoFilaAPagar(a) || '9999-99-99';
  const db = dataPagamentoFilaAPagar(b) || '9999-99-99';
  if (da !== db) return da.localeCompare(db);
  const lidaA = a?.a_pagar_lida ? 1 : 0;
  const lidaB = b?.a_pagar_lida ? 1 : 0;
  if (lidaA !== lidaB) return lidaA - lidaB;
  return String(dataReferenciaFila(b)).localeCompare(String(dataReferenciaFila(a)));
}

export function ordenarItensFilaAPagar(itens = []) {
  return [...(itens || [])].sort(compararPedidosFilaAPagar);
}

/** Junta contratos e orçamentos da fila e agrupa por unidade, como a lista de Pedidos. */
export function agruparFilaAssinaturaPorUnidade(orcamentos = [], contratos = []) {
  const itens = [
    ...(contratos || []).map((pedido) => ({ ...pedido, _filaKind: 'contrato' })),
    ...(orcamentos || []).map((pedido) => ({ ...pedido, _filaKind: 'orcamento' })),
  ];
  const mapa = new Map();
  for (const item of itens) {
    const chave = chaveUnidadeFila(item);
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        nome: nomeUnidadeFila(item),
        itens: [],
      });
    }
    mapa.get(chave).itens.push(item);
  }
  return [...mapa.values()].map((grupo) => {
    const datas = grupo.itens.map(dataReferenciaFila).filter(Boolean).sort();
    const tipos = [...new Set(
      grupo.itens.map((p) => p.tipo_rotulo || rotuloTipoPedido(p.tipo) || p.tipo).filter(Boolean),
    )];
    grupo.itens.sort((a, b) => String(dataReferenciaFila(b)).localeCompare(String(dataReferenciaFila(a))));
    return {
      ...grupo,
      qtd: grupo.itens.length,
      tiposRotulo: tipos.length <= 2 ? tipos.join(', ') : `${tipos.length} tipos`,
      atualizado: datas.at(-1) || '',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}
