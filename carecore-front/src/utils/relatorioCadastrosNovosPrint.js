import { imprimirRelatorio } from './imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint';
import {
  COLUNAS_EXPORTACAO_CADASTROS_NOVOS,
  formatarDataRelatorio,
  montarDadosExportacaoCadastrosNovos,
  rotuloCriterioCadastrosNovos,
  rotulosStatusFiltroCadastrosNovos,
} from './relatorioCadastrosNovosUtils';

export async function imprimirRelatorioCadastrosNovos({
  relatorio,
  identidadeRelatorio = null,
  tecnicoNome = null,
  busca = '',
}) {
  if (!relatorio?.linhas?.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const dados = montarDadosExportacaoCadastrosNovos(relatorio);

  const subtitulo = [
    `Período: ${formatarDataRelatorio(relatorio.data_inicio)} a ${formatarDataRelatorio(relatorio.data_fim)}`,
    `Critério: ${rotuloCriterioCadastrosNovos(relatorio.criterio)}`,
    `Situação no abrigo: ${rotulosStatusFiltroCadastrosNovos(relatorio.status_filtro)}`,
    tecnicoNome ? `Técnico: ${tecnicoNome}` : null,
    busca?.trim() ? `Busca: ${busca.trim()}` : null,
  ].filter(Boolean).join(' · ');

  imprimirRelatorio({
    titulo: 'Cadastros novos por período',
    subtitulo,
    metricas: [
      { label: 'Total de cadastros', valor: relatorio.total_cadastros ?? 0 },
    ],
    colunas: COLUNAS_EXPORTACAO_CADASTROS_NOVOS,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'portrait',
  });
}
