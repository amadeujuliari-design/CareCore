export const FILTROS_SITUACAO_PRESENCA = [
  {
    valor: 'presenca_ou_justificada',
    label: 'Com presença ou ausência justificada',
    descricao: 'Lista conviventes com pelo menos 1 dia presente (P) ou justificado (J) no período.',
  },
  {
    valor: 'apenas_ausencia',
    label: 'Com ausência no período',
    descricao: 'Lista conviventes com pelo menos 1 dia ausente (A) no período.',
  },
];

export const FILTROS_STATUS_CONVIVENTE_PRESENCA = [
  {
    valor: 'todos',
    label: 'Ativos + ausência justificada',
    descricao: 'Inclui os dois status no relatório (padrão).',
  },
  { valor: 'Ativo', label: 'Somente ativos' },
  { valor: 'Ausência justificada', label: 'Somente ausência justificada' },
];

export function rotuloFiltroSituacaoPresenca(valor) {
  return FILTROS_SITUACAO_PRESENCA.find((item) => item.valor === valor)?.label || valor;
}

export function rotuloFiltroStatusConviventePresenca(valor) {
  return FILTROS_STATUS_CONVIVENTE_PRESENCA.find((item) => item.valor === valor)?.label || valor;
}

export const ROTULO_STATUS_PRESENCA_DIA = {
  presente: 'P',
  justificado: 'J',
  ausente: 'A',
  na: '—',
};

export const DESCRICAO_STATUS_PRESENCA_DIA = {
  presente: 'Presente',
  justificado: 'Ausência justificada',
  ausente: 'Ausente',
  na: 'Fora do período de admissão',
};

export function classeCelulaPresencaDia(status) {
  if (status === 'presente') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  if (status === 'justificado') return 'bg-indigo-50 text-indigo-800 border-indigo-100';
  if (status === 'ausente') return 'bg-red-50 text-red-800 border-red-100';
  return 'bg-slate-50 text-slate-400 border-slate-100';
}

export function formatarDiaColuna(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
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
      Status: linha.status,
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
    'Status',
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
    'Status',
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
      Status: linha.status,
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
