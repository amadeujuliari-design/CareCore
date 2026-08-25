/** Tipos e rótulos de pedido Compras (espelha compras_regras.py). */

export const TIPO_CONSUMO = 'consumo';
export const TIPO_IMOBILIZADO = 'imobilizado';
export const TIPO_MANUTENCAO = 'manutencao';
export const TIPO_SERVICO = 'servico';

export const SEGMENTO_CONSUMO = 'consumo';
export const SEGMENTO_MANUTENCAO = 'manutencao';
export const SEGMENTO_IMOBILIZADO = 'imobilizado';
export const SEGMENTO_SERVICO = 'servico';

export const COMPETENCIA_SEDE = 'sede';
export const COMPETENCIA_PROJETO = 'projeto';

export const COMPETENCIAS_ORCAMENTO = [COMPETENCIA_SEDE, COMPETENCIA_PROJETO];

export const ROTULO_COMPETENCIA_ORCAMENTO = {
  [COMPETENCIA_SEDE]: 'Sede (orçado pela Sede)',
  [COMPETENCIA_PROJETO]: 'Projeto (orçado pelo projeto)',
};

export const SEGMENTOS_CATALOGO = [
  SEGMENTO_CONSUMO,
  SEGMENTO_MANUTENCAO,
  SEGMENTO_IMOBILIZADO,
  SEGMENTO_SERVICO,
];

export const ROTULO_SEGMENTO_CATALOGO = {
  [SEGMENTO_CONSUMO]: 'Consumo (janela)',
  [SEGMENTO_MANUTENCAO]: 'Manutenção',
  [SEGMENTO_IMOBILIZADO]: 'Bem / imobilizado',
  [SEGMENTO_SERVICO]: 'Prestação de serviço',
};

export const TIPOS_COTACAO_PROJETO = new Set([
  TIPO_IMOBILIZADO,
  TIPO_MANUTENCAO,
  TIPO_SERVICO,
]);

export const ROTULO_TIPO_PEDIDO = {
  [TIPO_CONSUMO]: 'Consumo',
  [TIPO_IMOBILIZADO]: 'Bem / imobilizado',
  [TIPO_MANUTENCAO]: 'Manutenção',
  [TIPO_SERVICO]: 'Prestação de serviço',
};

export function tipoEhCotacaoProjeto(tipo) {
  return TIPOS_COTACAO_PROJETO.has(String(tipo || '').trim().toLowerCase());
}

export function rotuloTipoPedido(tipo) {
  const chave = String(tipo || '').trim().toLowerCase();
  return ROTULO_TIPO_PEDIDO[chave] || chave || 'Pedido';
}

export function normalizarSegmentoCatalogo(valor) {
  const chave = String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (chave === 'manutencao' || chave.startsWith('manuten')) return SEGMENTO_MANUTENCAO;
  if (chave === 'imobilizado' || chave.includes('imobil')) return SEGMENTO_IMOBILIZADO;
  if (chave === 'servico' || chave.includes('servic')) return SEGMENTO_SERVICO;
  return SEGMENTO_CONSUMO;
}

export function rotuloSegmentoCatalogo(segmento) {
  const chave = normalizarSegmentoCatalogo(segmento);
  return ROTULO_SEGMENTO_CATALOGO[chave] || chave;
}

export function normalizarCompetenciaOrcamento(valor) {
  const chave = String(valor || '').trim().toLowerCase();
  if (chave === 'projeto' || chave === 'unidade') return COMPETENCIA_PROJETO;
  return COMPETENCIA_SEDE;
}

export function rotuloCompetenciaOrcamento(valor) {
  return ROTULO_COMPETENCIA_ORCAMENTO[normalizarCompetenciaOrcamento(valor)]
    || ROTULO_COMPETENCIA_ORCAMENTO[COMPETENCIA_SEDE];
}

export function competenciaPadraoDoSegmento(segmento) {
  const seg = normalizarSegmentoCatalogo(segmento);
  if (seg === SEGMENTO_MANUTENCAO || seg === SEGMENTO_IMOBILIZADO || seg === SEGMENTO_SERVICO) {
    return COMPETENCIA_PROJETO;
  }
  return COMPETENCIA_SEDE;
}

/** Segmento do catálogo para o tipo de pedido. Serviço → null (sem catálogo de produto). */
export function segmentoDoTipoPedido(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  if (t === TIPO_CONSUMO) return SEGMENTO_CONSUMO;
  if (t === TIPO_MANUTENCAO) return SEGMENTO_MANUTENCAO;
  if (t === TIPO_IMOBILIZADO) return SEGMENTO_IMOBILIZADO;
  if (t === TIPO_SERVICO) return null;
  return SEGMENTO_CONSUMO;
}

export function itensConsumoDoSegmentoPedido(itens = [], tipoPedido) {
  const segmento = segmentoDoTipoPedido(tipoPedido);
  if (segmento == null) return [];
  return (itens || []).filter(
    (item) => normalizarSegmentoCatalogo(item.segmento || SEGMENTO_CONSUMO) === segmento,
  );
}

export const BOTOES_NOVO_PEDIDO = [
  {
    tipo: TIPO_CONSUMO,
    titulo: 'Itens de consumo',
    descricao: 'Pedido da janela mensal. A Sede pede os orçamentos.',
  },
  {
    tipo: TIPO_IMOBILIZADO,
    titulo: 'Bem / imobilizado',
    descricao: 'Compra de bem. O projeto pede orçamento e envia à Sede.',
  },
  {
    tipo: TIPO_MANUTENCAO,
    titulo: 'Manutenção',
    descricao: 'Reparos e manutenção. O projeto conduz a cotação.',
  },
  {
    tipo: TIPO_SERVICO,
    titulo: 'Prestação de serviço',
    descricao: 'Serviços. O projeto conduz a cotação.',
  },
];

/** Etapas do stepper (cotação do projeto). */
export function etapaCotacaoProjeto(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'rascunho') return 1;
  if (s === 'em_cotacao' || s === 'aguardando_cotacao') return 2;
  if (s === 'aguardando_aprovacao_sede' || s === 'aguardando_aprovacao_unidade') return 4;
  if (s === 'aprovado') return 5;
  if (s === 'enviado_fornecedor') return 6;
  if (s === 'recebido') return 7;
  return 1;
}

export const STEPS_COTACAO_PROJETO = [
  { n: 1, rotulo: 'Montar' },
  { n: 2, rotulo: 'Pedir orçamento' },
  { n: 3, rotulo: 'Registrar' },
  { n: 4, rotulo: 'Sede' },
  { n: 5, rotulo: 'Assinado' },
  { n: 6, rotulo: 'Ao fornecedor' },
  { n: 7, rotulo: 'NF' },
];

function _normTipoTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Espelha compras_regras.chave_split_categoria_pedido.
 * Separação Carne/Peixe = pela categoria do cadastro, não pelo texto do item.
 * @returns {[string, string]} [chave, rotulo]
 */
export function chaveSplitCategoriaPedido(nomeCategoria, categoriaId = '') {
  const n = _normTipoTexto(nomeCategoria);
  if (n.includes('carne')) return ['carne', 'Carne'];
  if (n.includes('peixe')) return ['peixe', 'Peixe'];
  if (n.includes('aliment')) return ['alimentacao', 'Alimentação'];
  const cid = String(categoriaId || '').trim();
  const rotulo = String(nomeCategoria || '').trim() || 'Sem categoria';
  if (cid) return [`cat:${cid}`, rotulo];
  const chaveNome = _normTipoTexto(rotulo) || 'sem';
  return [`nome:${chaveNome}`, rotulo];
}

/** Itens do catálogo permitidos na edição de um pedido já separado por categoria. */
export function itensConsumoDoSplitPedido(itens = [], pedido) {
  const base = itensConsumoDoSegmentoPedido(itens, pedido?.tipo);
  if (!pedido?.grupo_split_id) return base;
  const [chavePedido] = chaveSplitCategoriaPedido(
    pedido.categoria_split_nome,
    pedido.categoria_split_id,
  );
  return (base || []).filter((item) => {
    const [chaveItem] = chaveSplitCategoriaPedido(item.categoria_nome, item.categoria_id);
    return chaveItem === chavePedido;
  });
}
