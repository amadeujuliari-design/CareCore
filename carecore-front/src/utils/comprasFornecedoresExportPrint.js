import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import { imprimirRelatorio } from './imprimirRelatorio.js';
import { rotuloProjetosFornecedor } from './comprasFornecedorUtils.js';
import { identidadeComprasParaImpressao } from './comprasItensConsumoExportPrint.js';

const COLUNAS = [
  'Fornecedor',
  'CNPJ',
  'Categoria',
  'Telefone',
  'E-mail',
  'Projetos',
  'Status',
];

function statusFornecedor(item) {
  if (item?.bloqueado) return 'Bloqueado';
  if (item?.ativo === false) return 'Inativo';
  return 'Ativo';
}

export function montarLinhasFornecedores(fornecedores = [], categorias = []) {
  const nomes = Object.fromEntries((categorias || []).map((c) => [c.id, c.nome]));
  return fornecedores.map((item) => {
    const cats = Array.isArray(item.categoria_ids) && item.categoria_ids.length
      ? item.categoria_ids.map((id) => nomes[id] || id).filter(Boolean).join(', ')
      : (nomes[item.categoria_id] || item.categoria_nome || '');
    return {
      Fornecedor: item.nome || '',
      CNPJ: item.cnpj || '',
      Categoria: cats,
      Telefone: item.telefone || '',
      'E-mail': item.email || item.email_empresa || '',
      Projetos: rotuloProjetosFornecedor(item) || '',
      Status: statusFornecedor(item),
    };
  });
}

function montarSubtitulo(filtros = {}) {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor}`);
  return partes.length ? partes.join(' · ') : 'Sem filtros';
}

export async function exportarFornecedores({ fornecedores = [], categorias = [], filtros = {} } = {}) {
  const dados = montarLinhasFornecedores(fornecedores, categorias);
  if (!dados.length) return false;
  await exportarRelatorioXlsx({
    nomeArquivo: `compras_fornecedores_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Compras – Fornecedores',
    filtros,
    colunas: COLUNAS,
    dados,
  });
  return true;
}

export async function imprimirFornecedores({
  fornecedores = [],
  categorias = [],
  filtros = {},
  sede = false,
} = {}) {
  const dados = montarLinhasFornecedores(fornecedores, categorias);
  if (!dados.length) return false;
  imprimirRelatorio({
    titulo: 'Compras – Fornecedores',
    subtitulo: montarSubtitulo(filtros),
    metricas: [{ label: 'Registros', valor: dados.length }],
    colunas: COLUNAS,
    dados,
    identidade: await identidadeComprasParaImpressao({ sede }),
    orientacao: 'landscape',
  });
  return true;
}
