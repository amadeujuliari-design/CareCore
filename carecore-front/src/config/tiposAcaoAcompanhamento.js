/** Tipos de ação alinhados ao relatório mensal (MAIO.2026) — espelho de tipos_acao_acompanhamento.py */

export const TIPOS_ACAO_ACOMPANHAMENTO = [
  {
    valor: 'Contatos familiares',
    linha_relatorio: 'Contatos Familiares',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: true,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos para cursos',
    linha_relatorio: 'Encaminhamentos para Cursos',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos PTR e benefícios sociais',
    linha_relatorio: 'Encaminhamentos PTR e Benefícios Sociais',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos escola formal',
    linha_relatorio: 'Encaminhamentos Escola formal',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos para trabalho',
    linha_relatorio: 'Encaminhamentos para Trabalho',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos para regularização de documentos',
    linha_relatorio: 'Encaminhamentos para Regularização de Documentos',
    natureza: 'saida_temporaria',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: false,
  },
  {
    valor: 'Encaminhamentos para CREAS POP',
    linha_relatorio: 'Encaminhamentos para CREAS POP',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Encaminhamentos para o SCP',
    linha_relatorio: 'Encaminhamentos para o SCP',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Encaminhamentos para outro C.A. ou C.T.A',
    linha_relatorio: 'Encaminhamentos para outro C.A. ou C.T.A',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Encaminhamentos para outro serviço da rede de Assistência',
    linha_relatorio: 'Encaminhamentos para outro serviço da rede de Assistência',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Casa Terapêutica',
    linha_relatorio: 'Casa Terapêutica',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'CTA',
    linha_relatorio: 'CTA',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'SIAT III - Ermelino',
    linha_relatorio: 'SIAT III - Ermelino',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'SIAT III - Heliópolis',
    linha_relatorio: 'SIAT III - Heliópolis',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'SIAT III - Penha',
    linha_relatorio: 'SIAT III - Penha',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Transferidos para Hotéis Sociais',
    linha_relatorio: 'Transferidos para Hotéis Sociais',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Saída autônoma para retorno familiar',
    linha_relatorio: 'Saída Autônoma para Retorno a Familiar',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Saída autônoma para retorno a local de origem',
    linha_relatorio: 'Saída Autônoma para Retorno a local de origem',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Saída autônoma para trabalho com alojamento',
    linha_relatorio: 'Saída Autônoma para Trabalho com Alojamento',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Saída autônoma para moradia autônoma',
    linha_relatorio: 'Saída Autônoma para Moradia Autônoma',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Desligamentos solicitados pelos conviventes',
    linha_relatorio: 'Desligamentos solicitados pelos conviventes',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Óbitos',
    linha_relatorio: 'Óbitos',
    natureza: 'saida_definitiva',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
  {
    valor: 'Outros',
    linha_relatorio: 'Outros',
    natureza: 'encaminhamento',
    sugerir_ausencia_justificada: false,
    sugerir_inativar: true,
  },
];

export const DESTINOS_TRANSFERENCIA = TIPOS_ACAO_ACOMPANHAMENTO.map(item => item.valor);

export const TIPOS_ACAO_POR_VALOR = Object.fromEntries(
  TIPOS_ACAO_ACOMPANHAMENTO.map(item => [item.valor, item]),
);

export const GRUPOS_NATUREZA_ACAO = {
  saida_temporaria: 'Saídas temporárias',
  encaminhamento: 'Encaminhamentos e transferências',
  saida_definitiva: 'Saídas definitivas / autônomas',
};

export function obterMetadadosTipoAcao(destino) {
  return TIPOS_ACAO_POR_VALOR[destino] || null;
}
