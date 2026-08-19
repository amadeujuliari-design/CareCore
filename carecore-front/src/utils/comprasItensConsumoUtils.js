export function normalizarBuscaItem(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function itemConsumoBateBusca(item, termo) {
  if (!termo) return true;
  const blob = [
    item.descricao,
    item.marca_preferencial,
    item.observacao,
    item.unidade_medida,
    item.embalagem,
    item.sinonimos,
    item.categoria_nome,
  ].join(' ');
  return normalizarBuscaItem(blob).includes(termo);
}

export function filtrarItensConsumo(itens = [], { busca = '', categoriaId = '', status = 'ativo' } = {}) {
  const termo = normalizarBuscaItem(busca);
  return itens.filter((item) => {
    if (status === 'ativo' && !item.ativo) return false;
    if (status === 'inativo' && item.ativo) return false;
    if (categoriaId && item.categoria_id !== categoriaId) return false;
    return itemConsumoBateBusca(item, termo);
  });
}

export function sugerirItensConsumo(itens = [], busca = '', limite = 12) {
  const termo = normalizarBuscaItem(busca);
  if (!termo) return [];
  return filtrarItensConsumo(itens, { busca, status: 'ativo' }).slice(0, limite);
}

export function itemConsumoPeloDetalheErro(itens = [], detail) {
  const texto = Array.isArray(detail)
    ? detail.map((item) => item?.msg || item).join(' ')
    : String(detail || '');
  if (!texto) return null;
  const achados = itens.filter((item) => item.descricao && texto.includes(item.descricao));
  if (achados.length === 0) return null;
  return [...achados].sort((a, b) => String(b.descricao).length - String(a.descricao).length)[0];
}

const UNIDADES_CONTAGEM = new Set([
  'un', 'und', 'uni', 'unid', 'unidade', 'unidades',
  'pct', 'pc', 'pcte', 'pacote', 'pacotes',
  'cx', 'caixa', 'caixas',
  'fd', 'fardo', 'fardos',
  'sc', 'saco', 'sacos',
  'rolo', 'rolos',
]);

const UNIDADES_PESO_VOLUME = new Set([
  'kg', 'g', 'gr', 'grama', 'gramas',
  'l', 'lt', 'litro', 'litros', 'ml',
]);

function chaveUnidade(texto) {
  return String(texto || '').trim().toLowerCase().replace(/\./g, '');
}

export function unidadeParaPedido(item = {}) {
  const original = String(item.unidade_medida || '').trim();
  const chave = chaveUnidade(original);
  if (UNIDADES_CONTAGEM.has(chave)) return original || 'un';
  if (String(item.embalagem || '').trim() && UNIDADES_PESO_VOLUME.has(chave)) {
    return 'un';
  }
  return original || 'un';
}

export function pedidoItemUnidadeConfusa(linha = {}) {
  const chave = chaveUnidade(linha.unidade_medida);
  return Boolean(String(linha.embalagem || '').trim()) && UNIDADES_PESO_VOLUME.has(chave);
}
