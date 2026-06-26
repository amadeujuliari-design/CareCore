import { exportarRelatorioXlsx } from './exportarRelatorioXlsx';
import { formatarDataBr } from './dataBrasilUtils';

function formatarDataCurta(valor) {
  if (!valor) return '';
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
}

export function montarDadosExportacaoGradeAtividade(grade, { somenteComPresenca = true } = {}) {
  if (!grade) return { colunas: [], linhas: [] };

  const linhasFonte = (grade.linhas || []).filter((linha) => {
    if (!somenteComPresenca) return true;
    return Object.values(linha.presencas_por_ocorrencia || {}).some(Boolean);
  });

  const colunas = [
    { chave: 'nome', rotulo: 'NOME' },
    { chave: 'prontuario', rotulo: 'Prontuário' },
    ...(grade.ocorrencias || []).map((ocorrencia, index) => ({
      chave: `sessao_${index}`,
      rotulo: formatarDataCurta(ocorrencia.data_sessao),
    })),
  ];

  const linhas = linhasFonte.map((linha) => {
    const item = {
      nome: linha.nome,
      prontuario: linha.prontuario || '',
    };
    (grade.ocorrencias || []).forEach((ocorrencia, index) => {
      const presenca = linha.presencas_por_ocorrencia?.[ocorrencia.id];
      item[`sessao_${index}`] = presenca ? 'P' : '';
    });
    return item;
  });

  return { colunas, linhas };
}

export function exportarGradeAtividadeXlsx(grade, opcoes = {}) {
  const atividadeNome = grade?.atividade?.nome || 'atividade';
  const mes = grade?.mes_referencia || 'periodo';
  const { colunas, linhas } = montarDadosExportacaoGradeAtividade(grade, opcoes);
  const colunasRotulo = colunas.map((coluna) => coluna.rotulo);

  exportarRelatorioXlsx({
    nomeArquivo: `grade_${atividadeNome}_${mes}`.replace(/[^\w.-]+/g, '_'),
    titulo: `Grade — ${atividadeNome} — ${mes}`,
    colunas: colunasRotulo,
    dados: linhas.map((linha) => {
      const registro = {};
      colunas.forEach((coluna) => {
        registro[coluna.rotulo] = linha[coluna.chave] ?? '';
      });
      return registro;
    }),
  });
}

export function montarDadosExportacaoRelatorioAtividades(relatorio, agrupamento) {
  if (!relatorio) return { colunas: [], dados: [] };

  if (agrupamento === 'por_atividade') {
    return {
      colunas: ['Atividade', 'Responsável', 'Sessões', 'Presenças', 'Conviventes'],
      dados: (relatorio.linhas || []).map((linha) => ({
        Atividade: linha.atividade_nome || linha.rotulo,
        Responsável: linha.responsavel_nome || '',
        Sessões: linha.total_sessoes ?? 0,
        Presenças: linha.total_presencas ?? 0,
        Conviventes: linha.total_conviventes ?? 0,
      })),
    };
  }

  if (agrupamento === 'por_convivente') {
    return {
      colunas: ['Convivente', 'Prontuário', 'Presenças', 'Atividades'],
      dados: (relatorio.linhas || []).map((linha) => ({
        Convivente: linha.convivente_nome || linha.rotulo,
        Prontuário: linha.prontuario || '',
        Presenças: linha.total_presencas ?? 0,
        Atividades: linha.total_atividades ?? 0,
      })),
    };
  }

  return {
    colunas: ['Data', 'Atividade', 'Responsável', 'Convivente', 'Prontuário', 'Método', 'Registrado por'],
    dados: (relatorio.linhas || []).map((linha) => ({
      Data: linha.data_sessao ? formatarDataCurta(linha.data_sessao) : '',
      Atividade: linha.atividade_nome || '',
      Responsável: linha.responsavel_nome || '',
      Convivente: linha.convivente_nome || '',
      Prontuário: linha.prontuario || '',
      Método: linha.metodo_leitura || '',
      'Registrado por': linha.registrado_por_nome || '',
    })),
  };
}

export function exportarRelatorioAtividadesXlsx(relatorio, agrupamento) {
  const { colunas, dados } = montarDadosExportacaoRelatorioAtividades(relatorio, agrupamento);
  const sufixo = agrupamento || 'detalhado';
  const periodoBr = `${formatarDataBr(relatorio.data_inicio)} a ${formatarDataBr(relatorio.data_fim)}`;
  exportarRelatorioXlsx({
    nomeArquivo: `relatorio_atividades_${relatorio.data_inicio}_${relatorio.data_fim}_${sufixo}`,
    titulo: `Relatório de atividades (${periodoBr})`,
    colunas,
    dados,
  });
}

const ROTULO_STATUS_CONFERENCIA_SISA = {
  conferida: 'Conferida',
  divergencia_quantidade: 'Divergência de quantidade',
  sem_vinculo: 'Sem vínculo',
  sem_ocorrencia_carecore: 'Sem sessão no CareCore+',
  somente_carecore: 'Só no CareCore+',
};

function rotuloStatusConferenciaSisa(status) {
  return ROTULO_STATUS_CONFERENCIA_SISA[status] || status || '';
}

function nomeAtividadeCarecoreConferencia(linha, vinculos = {}, atividades = []) {
  if (linha.atividade_nome) return linha.atividade_nome;
  const atividadeId = vinculos[linha.chave] || linha.atividade_id || linha.sugestao_atividade_id;
  if (!atividadeId) return '';
  return atividades.find((item) => item.id === atividadeId)?.nome || '';
}

function formatarDeltaConferencia(delta) {
  if (delta == null || delta === 0) return delta === 0 ? '0' : '';
  return delta > 0 ? `+${delta}` : String(delta);
}

export function montarDadosExportacaoConferenciaSisa(
  resultado,
  { vinculos = {}, atividades = [] } = {},
) {
  if (!resultado) return { colunas: [], dados: [] };

  const colunas = [
    'Status',
    'Data',
    'Horário',
    'Atividade SISA',
    'Tema SISA',
    'SISA',
    'CareCore+',
    'Delta',
    'Atividade CareCore+',
    'Observação',
  ];

  const dados = (resultado.linhas || []).map((linha) => ({
    Status: rotuloStatusConferenciaSisa(linha.status),
    Data: formatarDataCurta(linha.data_sessao),
    Horário: linha.horario || '',
    'Atividade SISA': linha.descricao_atividade || '',
    'Tema SISA': linha.descricao_tema || '',
    SISA: linha.participacoes_sisa ?? 0,
    'CareCore+': linha.participacoes_carecore ?? 0,
    Delta: formatarDeltaConferencia(linha.delta),
    'Atividade CareCore+': nomeAtividadeCarecoreConferencia(linha, vinculos, atividades),
    Observação: linha.mensagem || '',
  }));

  (resultado.somente_carecore || []).forEach((linha) => {
    dados.push({
      Status: rotuloStatusConferenciaSisa('somente_carecore'),
      Data: formatarDataCurta(linha.data_sessao),
      Horário: linha.horario || '',
      'Atividade SISA': linha.descricao_atividade || '',
      'Tema SISA': linha.descricao_tema || '',
      SISA: '',
      'CareCore+': linha.participacoes_carecore ?? 0,
      Delta: '',
      'Atividade CareCore+': linha.atividade_nome || '',
      Observação: linha.mensagem || '',
    });
  });

  return { colunas, dados };
}

export function exportarConferenciaSisaXlsx(resultado, opcoes = {}) {
  const { colunas, dados } = montarDadosExportacaoConferenciaSisa(resultado, opcoes);
  const inicio = resultado?.data_inicio_referencia || 'inicio';
  const fim = resultado?.data_fim_referencia || 'fim';
  exportarRelatorioXlsx({
    nomeArquivo: `conferencia_sisa_${inicio}_${fim}`,
    titulo: `Conferência SISA — ${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`,
    colunas,
    dados,
  });
}
