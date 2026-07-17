import { formatarDataBr } from './dataBrasilUtils.js';

export const CRITERIOS_CADASTROS_NOVOS = [
  {
    valor: 'inclusoes',
    label: 'Apenas novas inclusões',
    descricao: 'Data de inclusão dentro do período.',
  },
  {
    valor: 'nova_vinculacao',
    label: 'Apenas novas vinculações',
    descricao: 'Data de nova vinculação dentro do período.',
  },
  {
    valor: 'ambas',
    label: 'Inclusões e vinculações',
    descricao: 'Qualquer uma das duas datas no período.',
  },
];

export const STATUS_CONVIVENTE_CADASTROS_NOVOS = [
  { valor: 'Ativo', label: 'Ativo (Presente)' },
  { valor: 'Em acolhimento', label: 'Em acolhimento' },
  { valor: 'Ausência justificada', label: 'Ausência justificada' },
  { valor: 'Inativado', label: 'Inativado (Evadiu/Alta)' },
  { valor: 'Saída qualificada', label: 'Saída qualificada' },
  { valor: 'Bloqueado', label: 'Bloqueado (Suspensão)' },
];

export const STATUS_CADASTROS_NOVOS_PADRAO = [
  'Ativo',
  'Em acolhimento',
  'Ausência justificada',
];

export function rotuloStatusConviventeCadastrosNovos(valor) {
  return STATUS_CONVIVENTE_CADASTROS_NOVOS.find((item) => item.valor === valor)?.label || valor;
}

export function rotulosStatusFiltroCadastrosNovos(statuses = []) {
  return (statuses || [])
    .map((status) => rotuloStatusConviventeCadastrosNovos(status))
    .join(', ');
}

export function alternarStatusFiltroCadastrosNovos(statusAtual = [], valor) {
  if (statusAtual.includes(valor)) {
    const proximo = statusAtual.filter((item) => item !== valor);
    return proximo.length ? proximo : statusAtual;
  }
  return [...statusAtual, valor];
}

export function rotuloCriterioCadastrosNovos(valor) {
  return CRITERIOS_CADASTROS_NOVOS.find((item) => item.valor === valor)?.label || valor;
}

export function formatarDataRelatorio(iso) {
  if (!iso) return '—';
  return formatarDataBr(iso) || '—';
}

export const COLUNAS_EXPORTACAO_CADASTROS_NOVOS = [
  'Nome',
  'Nome da mãe',
  'Prontuário da saúde',
  'Data de inclusão',
  'Nova vinculação',
  'Status',
];

export function montarDadosExportacaoCadastrosNovos(relatorio) {
  return (relatorio?.linhas || []).map((linha) => ({
    Nome: linha.nome,
    'Nome da mãe': linha.nome_mae || '—',
    'Prontuário da saúde': linha.prontuario_saude || '—',
    'Data de inclusão': formatarDataRelatorio(linha.data_inclusao),
    'Nova vinculação': formatarDataRelatorio(linha.data_nova_vinculacao),
    Status: rotuloStatusConviventeCadastrosNovos(linha.status),
  }));
}
