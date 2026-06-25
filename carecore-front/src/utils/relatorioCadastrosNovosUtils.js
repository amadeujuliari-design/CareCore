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

export function rotuloCriterioCadastrosNovos(valor) {
  return CRITERIOS_CADASTROS_NOVOS.find((item) => item.valor === valor)?.label || valor;
}

export function formatarDataRelatorio(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = String(iso).split('T')[0].split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
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
    Status: linha.status,
  }));
}
