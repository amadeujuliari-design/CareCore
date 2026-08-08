import { imprimirRelatorio } from './imprimirRelatorio.js';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint.js';
import {
  OPCOES_IMPRESSAO_METAS_PADRAO,
  mesRotuloMetas,
  montarColunasMetasConsolidado,
  montarColunasMetasMensal,
  montarLinhasMetasConsolidado,
  montarLinhasMetasMensal,
  montarMetricasMetasMensal,
} from './relatorioNfpMetasPrintUtils.js';

export {
  OPCOES_IMPRESSAO_METAS_PADRAO,
  montarColunasMetasMensal,
  montarLinhasMetasMensal,
  montarMetricasMetasMensal,
  montarColunasMetasConsolidado,
  montarLinhasMetasConsolidado,
} from './relatorioNfpMetasPrintUtils.js';

export async function imprimirMetasMensal({
  dados,
  identidadeRelatorio = null,
  opcoes = OPCOES_IMPRESSAO_METAS_PADRAO,
} = {}) {
  const linhas = montarLinhasMetasMensal(dados, opcoes);
  if (!linhas.length) return false;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  imprimirRelatorio({
    titulo: 'NFP – Metas / Rateio mensal',
    subtitulo: [
      `Competência (pagamento): ${mesRotuloMetas(dados?.competencia)}`,
      `Ref. crédito SEFAZ: ${mesRotuloMetas(dados?.ref_credito)}`,
      dados?.titulo ? String(dados.titulo) : null,
    ].filter(Boolean).join(' · '),
    metricas: montarMetricasMetasMensal(dados, opcoes),
    colunas: montarColunasMetasMensal(opcoes),
    dados: linhas,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
  return true;
}

export async function imprimirMetasConsolidado({
  consolidado,
  identidadeRelatorio = null,
} = {}) {
  const linhas = montarLinhasMetasConsolidado(consolidado);
  if (!linhas.length) return false;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const meses = consolidado?.meses || [];
  imprimirRelatorio({
    titulo: 'NFP – Metas / Ranking consolidado',
    subtitulo: meses.length
      ? `Competências salvas: ${meses.map((m) => mesRotuloMetas(m.competencia)).join(', ')}`
      : 'Somas das competências salvas',
    metricas: [
      { label: 'Projetos', valor: linhas.length },
      { label: 'Competências', valor: meses.length },
    ],
    colunas: montarColunasMetasConsolidado(),
    dados: linhas,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
  return true;
}
