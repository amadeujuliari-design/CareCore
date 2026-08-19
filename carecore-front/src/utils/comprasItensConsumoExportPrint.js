import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import { imprimirRelatorio } from './imprimirRelatorio.js';
import {
  buscarIdentidadeRelatorios,
  buscarIdentidadeRelatoriosOrganizacao,
  obterLogoRelatorioDataUrl,
} from './relatorioIdentidadePrint.js';

const COLUNAS = ['Item', 'Categoria', 'Unidade', 'Embalagem', 'Marca', 'Status'];

function statusItem(item) {
  return item?.ativo === false ? 'Inativo' : 'Ativo';
}

export function montarLinhasItensConsumo(itens = []) {
  return itens.map((item) => ({
    Item: item.descricao || '',
    Categoria: item.categoria_nome || '',
    Unidade: item.unidade_medida || '',
    Embalagem: item.embalagem || '',
    Marca: item.marca_preferencial || '',
    Status: statusItem(item),
  }));
}

function montarSubtitulo(filtros = {}) {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor}`);
  return partes.length ? partes.join(' · ') : 'Sem filtros';
}

export async function identidadeComprasParaImpressao({ sede = false } = {}) {
  const identidade = sede
    ? await buscarIdentidadeRelatoriosOrganizacao()
    : await buscarIdentidadeRelatorios();
  const logo = await obterLogoRelatorioDataUrl(identidade);
  return {
    ...(identidade || {}),
    logo_src: logo || undefined,
  };
}

export async function exportarItensConsumo({ itens = [], filtros = {} } = {}) {
  const dados = montarLinhasItensConsumo(itens);
  if (!dados.length) return false;
  await exportarRelatorioXlsx({
    nomeArquivo: `compras_itens_consumo_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Compras – Itens de consumo',
    filtros,
    colunas: COLUNAS,
    dados,
  });
  return true;
}

export async function imprimirItensConsumo({ itens = [], filtros = {}, sede = false } = {}) {
  const dados = montarLinhasItensConsumo(itens);
  if (!dados.length) return false;
  imprimirRelatorio({
    titulo: 'Compras – Itens de consumo',
    subtitulo: montarSubtitulo(filtros),
    metricas: [{ label: 'Registros', valor: dados.length }],
    colunas: COLUNAS,
    dados,
    identidade: await identidadeComprasParaImpressao({ sede }),
    orientacao: 'landscape',
  });
  return true;
}
