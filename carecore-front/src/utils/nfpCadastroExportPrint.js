import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import { imprimirRelatorio } from './imprimirRelatorio.js';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './relatorioIdentidadePrint.js';
import { formatarCNPJ, formatarNumeroCadastro, formatarPercentual } from './nfpCadastroUtils.js';
import { formatarCPF, formatarTelefone } from './usuariosUtils.js';

function statusAtivo(valor) {
  return valor === false ? 'Inativo' : 'Ativo';
}

function rotuloOrigemDoador(origem) {
  if (origem === 'DOACAO_AUTOMATICA') return 'Doação automática';
  if (origem === 'PLANILHA') return 'Planilha';
  if (origem === 'MANUAL') return 'Manual';
  return origem || '—';
}

function montarSubtitulo(filtros = {}) {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor}`);
  return partes.length ? partes.join(' · ') : 'Sem filtros';
}

async function identidadeParaImpressao() {
  const identidade = await buscarIdentidadeRelatorios();
  const logo = await obterLogoRelatorioDataUrl(identidade);
  return {
    ...(identidade || {}),
    logo_src: logo || undefined,
  };
}

export function montarLinhasExportacaoAgentes(agentes = []) {
  return agentes.map((item) => ({
    Nº: formatarNumeroCadastro(item.numero_cadastro),
    Código: item.codigo || '',
    Nome: item.nome || '',
    'Nome fantasia': item.nome_fantasia || '',
    Tipo: item.tipo || '',
    CPF: item.cpf ? formatarCPF(item.cpf) : '',
    CNPJ: item.cnpj ? formatarCNPJ(item.cnpj) : '',
    Percentual: formatarPercentual(item.percentual_agente ?? 0),
    'E-mail': item.email || '',
    Telefone: item.telefone ? formatarTelefone(item.telefone) : '',
    Cidade: item.cidade || '',
    UF: item.uf || '',
    Status: statusAtivo(item.ativo),
    Observações: item.observacoes || '',
  }));
}

export function montarLinhasExportacaoDoadores(doadores = []) {
  return doadores.map((item) => ({
    Nº: formatarNumeroCadastro(item.numero_cadastro),
    Nome: item.nome || '',
    CPF: item.cpf ? formatarCPF(item.cpf) : '',
    Unidade: item.unidade_captador || '',
    Origem: rotuloOrigemDoador(item.origem_cadastro),
    'E-mail': item.email || '',
    Telefone: item.telefone ? formatarTelefone(item.telefone) : '',
    Cidade: item.cidade || '',
    UF: item.uf || '',
    Status: statusAtivo(item.ativo),
  }));
}

export function montarLinhasExportacaoCnpjs(cnpjs = []) {
  return cnpjs.map((item) => ({
    Nº: formatarNumeroCadastro(item.numero_cadastro),
    CNPJ: item.cnpj ? formatarCNPJ(item.cnpj) : '',
    Loja: item.loja || '',
    Captador: item.captador || '',
    'E-mail': item.email || '',
    Telefone: item.telefone ? formatarTelefone(item.telefone) : '',
    Conferir: item.cnpj_conferir ? 'Conferir' : 'OK',
    Cidade: item.cidade || '',
    UF: item.uf || '',
    Status: statusAtivo(item.ativo),
  }));
}

const COLUNAS_AGENTES = [
  'Nº', 'Código', 'Nome', 'Nome fantasia', 'Tipo', 'CPF', 'CNPJ',
  'Percentual', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Status', 'Observações',
];

const COLUNAS_DOADORES = [
  'Nº', 'Nome', 'CPF', 'Unidade', 'Origem', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Status',
];

const COLUNAS_CNPJS = [
  'Nº', 'CNPJ', 'Loja', 'Captador', 'E-mail', 'Telefone', 'Conferir', 'Cidade', 'UF', 'Status',
];

export async function exportarCadastroNfpAgentes({ agentes = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoAgentes(agentes);
  if (!dados.length) return false;
  await exportarRelatorioXlsx({
    nomeArquivo: `nfp_agentes_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'NFP – Cadastro de agentes captadores',
    filtros,
    colunas: COLUNAS_AGENTES,
    dados,
  });
  return true;
}

export async function imprimirCadastroNfpAgentes({ agentes = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoAgentes(agentes);
  if (!dados.length) return false;
  imprimirRelatorio({
    titulo: 'NFP – Agentes captadores',
    subtitulo: montarSubtitulo(filtros),
    metricas: [{ label: 'Registros', valor: dados.length }],
    colunas: COLUNAS_AGENTES,
    dados,
    identidade: await identidadeParaImpressao(),
    orientacao: 'landscape',
  });
  return true;
}

export async function exportarCadastroNfpDoadores({ doadores = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoDoadores(doadores);
  if (!dados.length) return false;
  await exportarRelatorioXlsx({
    nomeArquivo: `nfp_doadores_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'NFP – Cadastro de doadores',
    filtros,
    colunas: COLUNAS_DOADORES,
    dados,
  });
  return true;
}

export async function imprimirCadastroNfpDoadores({ doadores = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoDoadores(doadores);
  if (!dados.length) return false;
  imprimirRelatorio({
    titulo: 'NFP – Doadores',
    subtitulo: montarSubtitulo(filtros),
    metricas: [{ label: 'Registros', valor: dados.length }],
    colunas: COLUNAS_DOADORES,
    dados,
    identidade: await identidadeParaImpressao(),
    orientacao: 'landscape',
  });
  return true;
}

export async function exportarCadastroNfpCnpjs({ cnpjs = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoCnpjs(cnpjs);
  if (!dados.length) return false;
  await exportarRelatorioXlsx({
    nomeArquivo: `nfp_cnpjs_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'NFP – Cadastro de CNPJs / Lojas',
    filtros,
    colunas: COLUNAS_CNPJS,
    dados,
  });
  return true;
}

export async function imprimirCadastroNfpCnpjs({ cnpjs = [], filtros = {} } = {}) {
  const dados = montarLinhasExportacaoCnpjs(cnpjs);
  if (!dados.length) return false;
  imprimirRelatorio({
    titulo: 'NFP – CNPJs / Lojas',
    subtitulo: montarSubtitulo(filtros),
    metricas: [{ label: 'Registros', valor: dados.length }],
    colunas: COLUNAS_CNPJS,
    dados,
    identidade: await identidadeParaImpressao(),
    orientacao: 'landscape',
  });
  return true;
}
