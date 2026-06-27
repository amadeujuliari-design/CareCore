import { imprimirRelatorio } from './imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint';
import { formatarDiaColunaCompleto } from './relatorioPresencaUtils';
import {
  montarColunasImpressaoPresencaLegado,
  montarDadosImpressaoPresencaLegado,
} from './relatorioPresencaLegadoUtils';

const LEGENDA_PRESENCA_LEGADO_HTML = `
  <p style="margin:0 0 10px;font-size:10px;line-height:1.4;color:#4b5563;">
    <strong>Legenda:</strong>
    P = Presença importada do PDF SIAT · · = Sem registro no legado neste dia (não indica ausência operacional).
  </p>
`;

export async function imprimirRelatorioPresencaLegado({
  relatorio,
  identidadeRelatorio = null,
  busca = '',
}) {
  if (!relatorio?.linhas?.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const colunas = montarColunasImpressaoPresencaLegado(relatorio);
  const dados = montarDadosImpressaoPresencaLegado(relatorio);

  const subtitulo = [
    `Período: ${formatarDiaColunaCompleto(relatorio.data_inicio)} a ${formatarDiaColunaCompleto(relatorio.data_fim)}`,
    'Fonte: Histórico Legado — Rotina Legada (PDF SIAT)',
    busca?.trim() ? `Busca: ${busca.trim()}` : null,
  ].filter(Boolean).join(' · ');

  imprimirRelatorio({
    titulo: 'Presenças no histórico legado',
    subtitulo,
    metricas: [
      { label: 'Pessoas', valor: relatorio.total_pessoas ?? 0 },
      { label: 'Presenças (dias)', valor: relatorio.resumo?.presentes ?? 0 },
      { label: 'Dias no período', valor: relatorio.dias?.length ?? 0 },
    ],
    conteudoExtraHtml: LEGENDA_PRESENCA_LEGADO_HTML,
    colunas,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}
