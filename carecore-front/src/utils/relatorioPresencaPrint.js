import { imprimirRelatorio } from './imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from './relatorioIdentidadePrint';
import {
  AJUDA_COLUNA_JUSTIFICADO,
  formatarDiaColunaCompleto,
  montarColunasImpressaoPresenca,
  montarDadosImpressaoPresenca,
  rotuloFiltroSituacaoPresenca,
} from './relatorioPresencaUtils';

const LEGENDA_PRESENCA_HTML = `
  <p style="margin:0 0 10px;font-size:10px;line-height:1.4;color:#4b5563;">
    <strong>Legenda:</strong>
    P = Presente · J = Ausência justificada · A = Ausente · — = Fora de admissão ou após inativação
  </p>
  <p style="margin:0 0 10px;font-size:9px;line-height:1.4;color:#6b7280;">
    ${AJUDA_COLUNA_JUSTIFICADO}
  </p>
`;

export async function imprimirRelatorioPresencaPeriodo({
  relatorio,
  identidadeRelatorio = null,
  tecnicoNome = null,
  busca = '',
}) {
  if (!relatorio?.linhas?.length) return;

  const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
  const colunas = montarColunasImpressaoPresenca(relatorio);
  const dados = montarDadosImpressaoPresenca(relatorio);

  const subtitulo = [
    `Período: ${formatarDiaColunaCompleto(relatorio.data_inicio)} a ${formatarDiaColunaCompleto(relatorio.data_fim)}`,
    `Listagem: ${rotuloFiltroSituacaoPresenca(relatorio.filtro_situacao)}`,
    tecnicoNome ? `Técnico: ${tecnicoNome}` : null,
    busca?.trim() ? `Busca: ${busca.trim()}` : null,
  ].filter(Boolean).join(' · ');

  imprimirRelatorio({
    titulo: 'Presença e ausência por período',
    subtitulo,
    metricas: [
      { label: 'Conviventes', valor: relatorio.total_conviventes ?? 0 },
      { label: 'Presenças (dias)', valor: relatorio.resumo?.presentes ?? 0 },
      { label: 'Ausências (dias)', valor: relatorio.resumo?.ausentes ?? 0 },
      { label: 'Justificados', valor: relatorio.resumo?.justificados ?? 0 },
    ],
    conteudoExtraHtml: LEGENDA_PRESENCA_HTML,
    colunas,
    dados,
    identidade: {
      ...(identidadeRelatorio || {}),
      logo_src: logoRelatorioDataUrl || undefined,
    },
    orientacao: 'landscape',
  });
}
