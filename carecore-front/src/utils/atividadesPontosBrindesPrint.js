import { imprimirRelatorio } from './imprimirRelatorio.js';
import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint.js';
import {
  COLUNAS_RANKING_PONTOS_BRINDES,
  montarDadosExportacaoRankingPontos,
  montarMetricasRankingPontos,
} from './atividadesPontosBrindesPrintHelpers.js';

export {
  COLUNAS_RANKING_PONTOS_BRINDES,
  filtrarItensComSaldoPontos,
  montarDadosExportacaoRankingPontos,
  montarMetricasRankingPontos,
  resolverItensRelatorioPontosBrindes,
} from './atividadesPontosBrindesPrintHelpers.js';

export async function imprimirRankingPontosBrindes({
  itens = [],
  rotuloEscopo = '',
  identidadeRelatorio = null,
} = {}) {
  if (!itens.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const dados = montarDadosExportacaoRankingPontos(itens);

  imprimirRelatorio({
    titulo: 'Ranking de pontos e brindes',
    subtitulo: [
      rotuloEscopo || null,
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    ].filter(Boolean).join(' · '),
    metricas: montarMetricasRankingPontos(itens),
    colunas: COLUNAS_RANKING_PONTOS_BRINDES,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'portrait',
  });
}

export async function exportarRankingPontosBrindesXlsx({
  itens = [],
  rotuloEscopo = '',
} = {}) {
  if (!itens.length) return;

  return exportarRelatorioXlsx({
    nomeArquivo: `pontos-brindes-${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Ranking de pontos e brindes',
    filtros: {
      Escopo: rotuloEscopo || '—',
      Total: itens.length,
    },
    colunas: COLUNAS_RANKING_PONTOS_BRINDES,
    dados: montarDadosExportacaoRankingPontos(itens),
  });
}
