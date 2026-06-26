import { rotuloStatusConviventeCadastrosNovos } from './relatorioCadastrosNovosUtils';

export const FILTROS_SITUACAO_PRESENCA = [
  {
    valor: 'presenca_ou_justificada',
    label: 'Presentes no período',
    descricao: 'Conviventes com pelo menos 1 dia presente (P) ou justificado (J) no intervalo.',
  },
  {
    valor: 'apenas_ausencia',
    label: 'Ausentes no período',
    descricao: 'Conviventes com pelo menos 1 dia ausente (A) no intervalo, conforme regras do programa.',
  },
];

export function rotuloFiltroSituacaoPresenca(valor) {
  return FILTROS_SITUACAO_PRESENCA.find((item) => item.valor === valor)?.label || valor;
}

export function rotuloStatusAtualConvivente(status) {
  return rotuloStatusConviventeCadastrosNovos(status);
}

export const AJUDA_COLUNA_JUSTIFICADO = (
  'J reflete a situação cadastral atual (ausência justificada), não o histórico dia a dia do período.'
);

export const ROTULO_STATUS_PRESENCA_DIA = {
  presente: 'P',
  justificado: 'J',
  ausente: 'A',
  na: '—',
};

export const DESCRICAO_STATUS_PRESENCA_DIA = {
  presente: 'Presente (fluxo Entrada/Saída)',
  justificado: 'Ausência justificada no cadastro (situação atual)',
  ausente: 'Ausente (admitido, sem presença no dia)',
  na: 'Fora do período de admissão ou após inativação',
};

export function classeCelulaPresencaDia(status) {
  if (status === 'presente') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  if (status === 'justificado') return 'bg-indigo-50 text-indigo-800 border-indigo-100';
  if (status === 'ausente') return 'bg-red-50 text-red-800 border-red-100';
  return 'bg-slate-50 text-slate-400 border-slate-100';
}

export function formatarDiaColuna(iso) {
  if (!iso) return '';
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

export function formatarDiaColunaCompleto(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function montarDadosExportacaoPresenca(relatorio) {
  const dias = relatorio?.dias || [];

  return (relatorio?.linhas || []).map((linha) => {
    const registro = {
      Nome: linha.nome,
      Prontuário: linha.prontuario ? `#${linha.prontuario}` : 'S/N',
      'Situação atual': rotuloStatusAtualConvivente(linha.status),
      Técnico: linha.tecnico_nome || 'Sem técnico',
      SISA: linha.numero_sisa || '-',
    };

    dias.forEach((dia) => {
      const status = linha.dias?.[dia] || 'na';
      registro[formatarDiaColunaCompleto(dia)] = DESCRICAO_STATUS_PRESENCA_DIA[status] || status;
    });

    registro['Total presenças'] = linha.totais?.presentes ?? 0;
    registro['Total ausências'] = linha.totais?.ausentes ?? 0;
    registro['Dias justificados'] = linha.totais?.justificados ?? 0;

    return registro;
  });
}

export function montarColunasExportacaoPresenca(relatorio) {
  const dias = relatorio?.dias || [];
  return [
    'Nome',
    'Prontuário',
    'Situação atual',
    'Técnico',
    'SISA',
    ...dias.map((dia) => formatarDiaColunaCompleto(dia)),
    'Total presenças',
    'Total ausências',
    'Dias justificados',
  ];
}

export function montarColunasImpressaoPresenca(relatorio) {
  const dias = relatorio?.dias || [];
  return [
    'Convivente',
    'Prontuário',
    'Situação atual',
    'Técnico',
    ...dias.map((dia) => formatarDiaColuna(dia)),
    'Pres.',
    'Aus.',
  ];
}

export function montarDadosImpressaoPresenca(relatorio) {
  const dias = relatorio?.dias || [];

  return (relatorio?.linhas || []).map((linha) => {
    const registro = {
      Convivente: linha.nome,
      Prontuário: linha.prontuario ? `#${linha.prontuario}` : 'S/N',
      'Situação atual': rotuloStatusAtualConvivente(linha.status),
      Técnico: linha.tecnico_nome || '—',
    };

    dias.forEach((dia) => {
      const status = linha.dias?.[dia] || 'na';
      registro[formatarDiaColuna(dia)] = ROTULO_STATUS_PRESENCA_DIA[status] || status;
    });

    registro['Pres.'] = linha.totais?.presentes ?? 0;
    registro['Aus.'] = linha.totais?.ausentes ?? 0;

    return registro;
  });
}
