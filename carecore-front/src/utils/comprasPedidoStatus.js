/** Rótulos e badges de status do pedido de Compras (lista + detalhe). */

export const STATUS_LABEL_PEDIDO = {
  rascunho: 'Rascunho',
  aguardando_cotacao: 'Aguardando cotação',
  em_cotacao: 'Em cotação',
  aguardando_escolha_orcamento: 'Pronto para escolher',
  aguardando_aprovacao_unidade: 'Aguardando unidade',
  aguardando_aprovacao_sede: 'Aguardando Sede',
  aprovado: 'Aprovado',
  enviado_fornecedor: 'Enviado ao fornecedor',
  recebido: 'Encerrado',
  cancelado: 'Cancelado',
  reprovado: 'Reprovado',
};

/** Contador n/3 só na fase de cotação (evita “Enviado · 3/3”). */
const STATUS_COM_PROGRESSO_ORCAMENTOS = new Set([
  'rascunho',
  'aguardando_cotacao',
  'em_cotacao',
  'aguardando_escolha_orcamento',
]);

export function statusMostraProgressoOrcamentos(status) {
  return STATUS_COM_PROGRESSO_ORCAMENTOS.has(String(status || ''));
}

/** variant do PremiumBadge */
export function varianteBadgeStatusPedido(status) {
  const s = String(status || '');
  if (s === 'aguardando_escolha_orcamento') return 'info';
  if (s === 'em_cotacao' || s === 'aguardando_cotacao') return 'warning';
  if (s === 'aguardando_aprovacao_unidade' || s === 'aguardando_aprovacao_sede') return 'purple';
  if (s === 'aprovado' || s === 'enviado_fornecedor' || s === 'recebido') return 'success';
  if (s === 'cancelado' || s === 'reprovado') return 'danger';
  return 'default';
}

/**
 * Rótulo do badge de status (sem n/3 — o contador fica na coluna Orçamentos).
 * Em cotação sem anexos: “aguardando retorno”.
 */
export function rotuloStatusPedidoLista(pedido) {
  const status = pedido?.status || '';
  const base = STATUS_LABEL_PEDIDO[status] || status || '—';
  const comAnexo = Number(pedido?.orcamentos_com_anexo ?? 0);

  if ((status === 'em_cotacao' || status === 'aguardando_cotacao') && comAnexo <= 0) {
    return `${base} · aguardando retorno`;
  }
  return base;
}

/** Retorna `n/min` só na fase de cotação; senão null. */
export function progressoOrcamentosTexto(pedido) {
  if (!statusMostraProgressoOrcamentos(pedido?.status)) return null;
  const min = Number(pedido?.min_orcamentos_recomendados || 3);
  const comAnexo = Number(pedido?.orcamentos_com_anexo ?? 0);
  return `${comAnexo}/${min}`;
}
