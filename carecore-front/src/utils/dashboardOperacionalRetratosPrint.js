import { imprimirRelatorio } from './imprimirRelatorio.js';
import { exportarRelatorioXlsx } from './exportarRelatorioXlsx.js';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint.js';
import {
  COLUNAS_RETRATOS_DASHBOARD,
  formatarDataBrRetrato,
  montarDadosRetratosDashboard,
  montarMetricasRetratosDashboard,
} from './dashboardOperacionalRetratosPrintHelpers.js';

export {
  COLUNAS_RETRATOS_DASHBOARD,
  montarDadosRetratosDashboard,
  montarMetricasRetratosDashboard,
} from './dashboardOperacionalRetratosPrintHelpers.js';

export async function imprimirRetratosDashboardOperacional({
  itens = [],
  dataInicio = '',
  dataFim = '',
  identidadeRelatorio = null,
} = {}) {
  if (!itens.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const dados = montarDadosRetratosDashboard(itens);
  const periodo = [
    dataInicio ? formatarDataBrRetrato(dataInicio) : null,
    dataFim ? formatarDataBrRetrato(dataFim) : null,
  ].filter(Boolean).join(' a ');

  imprimirRelatorio({
    titulo: 'Retratos do Dashboard Operacional',
    subtitulo: [
      periodo ? `Período: ${periodo}` : null,
      'Foto diária às 22:40 (São Paulo)',
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    ].filter(Boolean).join(' · '),
    metricas: montarMetricasRetratosDashboard(itens),
    colunas: COLUNAS_RETRATOS_DASHBOARD,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}

export async function exportarRetratosDashboardOperacionalXlsx({
  itens = [],
  dataInicio = '',
  dataFim = '',
} = {}) {
  if (!itens.length) return;

  return exportarRelatorioXlsx({
    nomeArquivo: `dashboard-operacional-retratos-${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Retratos do Dashboard Operacional',
    filtros: {
      'Data início': dataInicio ? formatarDataBrRetrato(dataInicio) : '—',
      'Data fim': dataFim ? formatarDataBrRetrato(dataFim) : '—',
      Horário: '22:40 (São Paulo)',
      Dias: itens.length,
    },
    colunas: COLUNAS_RETRATOS_DASHBOARD,
    dados: montarDadosRetratosDashboard(itens),
  });
}
