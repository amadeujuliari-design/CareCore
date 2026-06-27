import { formatarDiaColuna, formatarDiaColunaCompleto } from './relatorioPresencaUtils';

export const ROTULO_STATUS_PRESENCA_LEGADO_DIA = {
  presente: 'P',
  sem_registro: '·',
};

export const DESCRICAO_STATUS_PRESENCA_LEGADO_DIA = {
  presente: 'Presença registrada no legado (PDF SIAT)',
  sem_registro: 'Sem registro de presença no legado neste dia',
};

export function classeCelulaPresencaLegadoDia(status) {
  if (status === 'presente') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  return 'bg-slate-50 text-slate-300 border-slate-100';
}

export function montarColunasExportacaoPresencaLegado(relatorio) {
  const dias = relatorio?.dias || [];
  return [
    'Nome',
    'SISA',
    'Prontuário',
    'Arquivo origem',
    ...dias.map((dia) => formatarDiaColunaCompleto(dia)),
    'Total presenças',
  ];
}

export function montarDadosExportacaoPresencaLegado(relatorio) {
  const dias = relatorio?.dias || [];

  return (relatorio?.linhas || []).map((linha) => {
    const registro = {
      Nome: linha.nome,
      SISA: linha.numero_sisa || '-',
      Prontuário: linha.prontuario ? `#${linha.prontuario}` : 'S/N',
      'Arquivo origem': linha.origem_arquivo || '-',
    };

    dias.forEach((dia) => {
      const status = linha.dias?.[dia] || 'sem_registro';
      registro[formatarDiaColunaCompleto(dia)] = status === 'presente' ? 'Presente' : '';
    });

    registro['Total presenças'] = linha.totais?.presentes ?? 0;
    return registro;
  });
}

export function montarColunasImpressaoPresencaLegado(relatorio) {
  const dias = relatorio?.dias || [];
  return [
    'Convivente',
    'SISA',
    'Prontuário',
    ...dias.map((dia) => formatarDiaColuna(dia)),
    'Pres.',
  ];
}

export function montarDadosImpressaoPresencaLegado(relatorio) {
  const dias = relatorio?.dias || [];

  return (relatorio?.linhas || []).map((linha) => {
    const registro = {
      Convivente: linha.nome,
      SISA: linha.numero_sisa || '—',
      Prontuário: linha.prontuario ? `#${linha.prontuario}` : 'S/N',
    };

    dias.forEach((dia) => {
      const status = linha.dias?.[dia] || 'sem_registro';
      registro[formatarDiaColuna(dia)] = ROTULO_STATUS_PRESENCA_LEGADO_DIA[status] || '';
    });

    registro['Pres.'] = linha.totais?.presentes ?? 0;
    return registro;
  });
}
