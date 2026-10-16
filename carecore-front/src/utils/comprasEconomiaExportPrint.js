import { formatarDataBr } from './dataBrasilUtils.js';

function moneyCentavos(centavos) {
  return (Number(centavos || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

const COLUNAS = [
  'Projeto',
  'Linha',
  'Pedido',
  'Competência',
  'Data',
  'Tipo',
  'Valor cheio',
  'Valor escolhida',
  'Economia vs maior',
  'Economia vs média',
];

function dataPedido(linha) {
  return linha?.data_referencia ? formatarDataBr(linha.data_referencia) : '';
}

export function montarLinhasEconomia(projetos = []) {
  const dados = [];
  projetos.forEach((projeto) => {
    dados.push({
      Projeto: projeto.nome || '',
      Linha: 'Total do projeto',
      Pedido: '',
      Competência: '',
      Data: '',
      Tipo: '',
      'Valor cheio': moneyCentavos(projeto.total_cheio_centavos),
      'Valor escolhida': moneyCentavos(projeto.total_escolhida_centavos),
      'Economia vs maior': moneyCentavos(projeto.economia_vs_maior_centavos),
      'Economia vs média': moneyCentavos(projeto.economia_vs_media_centavos),
    });
    (projeto.linhas || []).forEach((linha) => {
      dados.push({
        Projeto: projeto.nome || '',
        Linha: 'Pedido',
        Pedido: linha.titulo || '',
        Competência: linha.competencia || '',
        Data: dataPedido(linha),
        Tipo: linha.tipo_rotulo || linha.tipo || '',
        'Valor cheio': moneyCentavos(linha.valor_cheio_centavos),
        'Valor escolhida': moneyCentavos(linha.valor_escolhida_centavos),
        'Economia vs maior': moneyCentavos(linha.economia_vs_maior_centavos),
        'Economia vs média': moneyCentavos(linha.economia_vs_media_centavos),
      });
    });
  });
  return dados;
}

function montarSubtitulo(filtros = {}) {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor}`);
  return partes.length ? partes.join(' · ') : 'Sem filtros';
}

export async function exportarEconomia({ projetos = [], filtros = {}, resumo = {} } = {}) {
  const dados = montarLinhasEconomia(projetos);
  if (!dados.length) return false;
  const { exportarRelatorioXlsx } = await import('./exportarRelatorioXlsx.js');
  await exportarRelatorioXlsx({
    nomeArquivo: `compras_economia_${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Compras – Economia das cotações',
    filtros,
    colunas: COLUNAS,
    dados,
    blocoTotais: [
      ['Pedidos', resumo.pedidos ?? ''],
      ['Valor cheio', moneyCentavos(resumo.total_cheio_centavos)],
      ['Valor escolhida', moneyCentavos(resumo.total_escolhida_centavos)],
      ['Economia vs maior', moneyCentavos(resumo.economia_vs_maior_centavos)],
      ['Economia vs média', moneyCentavos(resumo.economia_vs_media_centavos)],
    ],
  });
  return true;
}

export async function imprimirEconomia({
  projetos = [],
  filtros = {},
  resumo = {},
  sede = false,
} = {}) {
  const dados = montarLinhasEconomia(projetos);
  if (!dados.length) return false;
  const { imprimirRelatorio } = await import('./imprimirRelatorio.js');
  const { identidadeComprasParaImpressao } = await import('./comprasItensConsumoExportPrint.js');
  imprimirRelatorio({
    titulo: 'Compras – Economia das cotações',
    subtitulo: montarSubtitulo(filtros),
    metricas: [
      { label: 'Pedidos', valor: resumo.pedidos ?? 0 },
      { label: 'Valor cheio', valor: moneyCentavos(resumo.total_cheio_centavos) },
      { label: 'Valor escolhida', valor: moneyCentavos(resumo.total_escolhida_centavos) },
      { label: 'Economia vs maior', valor: moneyCentavos(resumo.economia_vs_maior_centavos) },
      { label: 'Economia vs média', valor: moneyCentavos(resumo.economia_vs_media_centavos) },
    ],
    colunas: COLUNAS,
    dados,
    identidade: await identidadeComprasParaImpressao({ sede }),
    orientacao: 'landscape',
  });
  return true;
}
