export function normalizarBuscaItem(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Códigos canônicos — select do cadastro de item de consumo. */
export const UNIDADES_MEDIDA_ITEM = [
  { value: 'un', label: 'un — unidade' },
  { value: 'kg', label: 'kg — quilograma' },
  { value: 'g', label: 'g — grama' },
  { value: 'pct', label: 'pct — pacote' },
  { value: 'cx', label: 'cx — caixa' },
  { value: 'fardo', label: 'fardo' },
  { value: 'rolo', label: 'rolo' },
  { value: 'l', label: 'l — litro' },
  { value: 'ml', label: 'ml — mililitro' },
  { value: 'm', label: 'm — metro' },
];

const ALIAS_UNIDADE_MEDIDA = {
  und: 'un',
  uni: 'un',
  unid: 'un',
  unidade: 'un',
  unidades: 'un',
  u: 'un',
  quilo: 'kg',
  quilos: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilograma: 'kg',
  quilograma: 'kg',
  pc: 'pct',
  pcte: 'pct',
  pacote: 'pct',
  pacotes: 'pct',
  caixa: 'cx',
  caixas: 'cx',
  fardos: 'fardo',
  rolos: 'rolo',
  lt: 'l',
  litro: 'l',
  litros: 'l',
  gr: 'g',
  grama: 'g',
  gramas: 'g',
  mt: 'm',
  metro: 'm',
  metros: 'm',
  balde: 'un',
  baldes: 'un',
};

export function sanitizarUnidadeMedida(valor) {
  const texto = String(valor || '').trim().toLowerCase().replace(/\./g, '');
  if (!texto) return '';
  if (UNIDADES_MEDIDA_ITEM.some((u) => u.value === texto)) return texto;
  if (ALIAS_UNIDADE_MEDIDA[texto]) return ALIAS_UNIDADE_MEDIDA[texto];
  const alias = Object.keys(ALIAS_UNIDADE_MEDIDA).find((chave) => texto.startsWith(chave));
  if (alias) return ALIAS_UNIDADE_MEDIDA[alias];
  return 'un';
}

/** Só dígitos e no máximo um separador decimal (, ou .). */
export function digitarQuantidadeEmbalagem(valor) {
  let texto = String(valor ?? '').replace(/[^\d.,]/g, '');
  const sep = texto.includes(',') ? ',' : (texto.includes('.') ? '.' : '');
  if (!sep) return texto.replace(/\D/g, '').slice(0, 6);
  const [inteiro, ...resto] = texto.split(sep);
  const dec = resto.join('').replace(/\D/g, '').slice(0, 3);
  return `${inteiro.replace(/\D/g, '').slice(0, 6)}${sep}${dec}`;
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

const UNIDADES_CONTINUAS = new Set([
  'kg', 'g', 'gr', 'grama', 'gramas',
  'l', 'lt', 'litro', 'litros', 'ml',
  'm', 'mt', 'metro', 'metros', 'cm', 'mm',
]);

function chaveUnidade(texto) {
  return String(texto || '').trim().toLowerCase().replace(/\./g, '');
}

export function inferirFatorEmbalagem(embalagem) {
  const texto = String(embalagem || '').trim();
  if (!texto) return null;
  const achado = texto.match(/(\d+(?:[.,]\d+)?)/);
  if (!achado) return null;
  const numero = Number.parseFloat(achado[1].replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0 || numero > 10000) return null;
  return numero;
}

export function fatorEmbalagemEfetivo(item = {}) {
  const bruto = item.fator_embalagem;
  if (bruto !== null && bruto !== undefined && String(bruto).trim() !== '') {
    const numero = Number.parseFloat(String(bruto).replace(',', '.'));
    if (Number.isFinite(numero) && numero > 0) return numero;
  }
  return inferirFatorEmbalagem(item.embalagem);
}

export function unidadeParaPedido(item = {}) {
  const original = String(item.unidade_medida || '').trim();
  const chave = chaveUnidade(original);
  if (UNIDADES_CONTAGEM.has(chave)) return original || 'un';
  const fator = fatorEmbalagemEfetivo(item);
  // Fator diferente de 1: conta a embalagem (un), não kg/L/m.
  if (UNIDADES_CONTINUAS.has(chave) && fator != null && fator !== 1) {
    return 'un';
  }
  return original || 'un';
}

export function pedidoItemUnidadeConfusa(linha = {}) {
  const chave = chaveUnidade(linha.unidade_medida);
  if (!UNIDADES_CONTINUAS.has(chave)) return false;
  const fator = fatorEmbalagemEfetivo(linha);
  return fator != null && fator !== 1;
}
