import { imprimirRelatorio } from './imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint';
import {
  COLUNAS_RATEIO_CONSOLIDADO_AGENTE,
  COLUNAS_RATEIO_CONSOLIDADO_COMP,
  COLUNAS_RATEIO_DETALHADO,
  COLUNAS_CUPONS_DETALHE,
  COLUNAS_CUPONS_POR_CAPTADOR,
  moneyRelatorioNfp,
  montarExportacaoRateioConsolidadoAgente,
  montarExportacaoRateioConsolidadoComp,
  montarExportacaoRateioDetalhado,
  montarExportacaoCuponsDetalhe,
  montarExportacaoCuponsPorCaptador,
  rotuloStatusCupomRelatorio,
} from './relatorioNfpUtils';

export async function imprimirRelatorioNfpRateioConsolidado({
  relatorio,
  identidadeRelatorio = null,
  aba = 'competencia',
}) {
  const dados = aba === 'agente'
    ? montarExportacaoRateioConsolidadoAgente(relatorio)
    : montarExportacaoRateioConsolidadoComp(relatorio);
  if (!dados.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const totais = relatorio?.totais || {};
  const periodo = [
    relatorio?.competencia_inicio || 'início',
    relatorio?.competencia_fim || 'fim',
  ].join(' a ');

  imprimirRelatorio({
    titulo: 'NFP – Rateio consolidado',
    subtitulo: [
      `Período: ${periodo}`,
      relatorio?.agente ? `Agente: ${relatorio.agente}` : 'Agente: todos',
      aba === 'agente' ? 'Visão: por agente' : 'Visão: por competência',
    ].join(' · '),
    metricas: [
      { label: 'Total créditos', valor: moneyRelatorioNfp(totais.total_creditos) },
      { label: 'Parte agente', valor: moneyRelatorioNfp(totais.parte_agente) },
      { label: 'Parte AEB', valor: moneyRelatorioNfp(totais.parte_aeb) },
      { label: 'Linhas', valor: totais.qtd_linhas ?? 0 },
    ],
    colunas: aba === 'agente' ? COLUNAS_RATEIO_CONSOLIDADO_AGENTE : COLUNAS_RATEIO_CONSOLIDADO_COMP,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}

export async function imprimirRelatorioNfpRateioDetalhado({
  relatorio,
  identidadeRelatorio = null,
}) {
  const dados = montarExportacaoRateioDetalhado(relatorio);
  if (!dados.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const totais = relatorio?.totais || {};

  imprimirRelatorio({
    titulo: 'NFP – Rateio detalhado',
    subtitulo: [
      `Competência: ${relatorio?.competencia || '—'}`,
      relatorio?.agente ? `Agente: ${relatorio.agente}` : 'Agente: todos',
      relatorio?.origem ? `Origem: ${relatorio.origem}` : null,
      relatorio?.busca ? `Busca: ${relatorio.busca}` : null,
    ].filter(Boolean).join(' · '),
    metricas: [
      { label: 'Total créditos', valor: moneyRelatorioNfp(totais.total_creditos) },
      { label: 'Parte agente', valor: moneyRelatorioNfp(totais.parte_agente) },
      { label: 'Parte AEB', valor: moneyRelatorioNfp(totais.parte_aeb) },
      { label: 'Linhas', valor: totais.qtd_linhas ?? 0 },
    ],
    colunas: COLUNAS_RATEIO_DETALHADO,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}

export async function imprimirRelatorioNfpCupons({
  relatorio,
  identidadeRelatorio = null,
  aba = 'captador',
}) {
  const dados = aba === 'detalhe'
    ? montarExportacaoCuponsDetalhe(relatorio)
    : montarExportacaoCuponsPorCaptador(relatorio);
  if (!dados.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const totais = relatorio?.totais || {};
  const filtros = relatorio?.filtros || {};
  const periodo = [
    filtros.data_inicio || 'início',
    filtros.data_fim || 'fim',
  ].join(' a ');

  imprimirRelatorio({
    titulo: 'NFP – Cupons lidos / fila / enviados',
    subtitulo: [
      `Período (${filtros.eixo_data === 'enviado_em' ? 'enviado em' : 'lido em'}): ${periodo}`,
      filtros.captador ? `Captador: ${filtros.captador}` : 'Captador: todos',
      Array.isArray(filtros.status) && filtros.status.length
        ? `Status: ${filtros.status.map(rotuloStatusCupomRelatorio).join(', ')}`
        : 'Status: todos',
      filtros.busca ? `Busca: ${filtros.busca}` : null,
      aba === 'detalhe' ? 'Visão: detalhe' : 'Visão: por captador',
    ].filter(Boolean).join(' · '),
    metricas: [
      { label: 'Lidos', valor: totais.lidos ?? 0 },
      { label: 'Pendentes', valor: totais.pendentes ?? 0 },
      { label: 'Enviados', valor: totais.enviados ?? 0 },
      { label: 'Erros', valor: totais.erros ?? 0 },
    ],
    colunas: aba === 'detalhe' ? COLUNAS_CUPONS_DETALHE : COLUNAS_CUPONS_POR_CAPTADOR,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}
