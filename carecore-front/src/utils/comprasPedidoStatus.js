/** Rótulos e badges de status do pedido de Compras (lista + detalhe). */

export const STATUS_LABEL_PEDIDO = {
  rascunho: 'Rascunho',
  aguardando_nf: 'Aguardando NF',
  aguardando_assinatura_nf: 'Aguardando assinatura da NF',
  aguardando_cotacao: 'Aguardando cotação',
  em_cotacao: 'Em cotação',
  aguardando_escolha_orcamento: 'Pronto para escolher',
  aguardando_aprovacao_unidade: 'Aguardando unidade',
  aguardando_aprovacao_sede: 'Aguardando Sede',
  aprovado: 'Aprovado',
  enviado_fornecedor: 'Enviado ao fornecedor',
  aguardando_pagamento: 'Aguardando pagamento',
  aguardando_conferencia_extrato: 'Aguardando conferência do extrato',
  recebido: 'Encerrado',
  imprimir_nf: 'Imprimir NF',
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

/**
 * Cor do badge por status (fonte única lista + ficha).
 * Mesmo status → mesma cor em todo o módulo Compras.
 */
const VARIANTE_BADGE_STATUS_PEDIDO = {
  rascunho: 'default',
  aguardando_nf: 'cyan',
  aguardando_assinatura_nf: 'fuchsia',
  aguardando_cotacao: 'warning',
  em_cotacao: 'warning',
  aguardando_escolha_orcamento: 'info',
  aguardando_aprovacao_unidade: 'purple',
  aguardando_aprovacao_sede: 'indigo',
  aprovado: 'success',
  enviado_fornecedor: 'teal',
  aguardando_pagamento: 'orange',
  aguardando_conferencia_extrato: 'lime',
  imprimir_nf: 'sky',
  recebido: 'success',
  cancelado: 'danger',
  reprovado: 'danger',
};

/** variant do PremiumBadge */
export function varianteBadgeStatusPedido(status) {
  const s = String(status || '');
  return VARIANTE_BADGE_STATUS_PEDIDO[s] || 'default';
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
