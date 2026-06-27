import {
  compararConviventesPorBusca,
  conviventeCorrespondeBusca,
  normalizarTextoBusca,
} from './conviventeBuscaUtils';
import { formatarDataBr } from './dataBrasilUtils';
import { rotuloRepeticaoExtraRefeicao } from './rotinaRefeicaoUtils';
import {
  tipoRegistroAlimentacao,
  TIPOS_ROTINA_REFEICOES,
} from './rotinaDiariaUtils.js';

export { TIPOS_ROTINA_REFEICOES };

export const PERFIS_GESTAO_ROTINA = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
export const PERFIS_MANUTENCAO_ROTINA = ['Manutenção', 'Manutencao'];

export function usuarioPodeGerenciarHistoricoRotina(
  perfilUsuario = '',
  { isManutencao = false } = {},
) {
  return (
    PERFIS_GESTAO_ROTINA.includes(perfilUsuario)
    || PERFIS_MANUTENCAO_ROTINA.includes(perfilUsuario)
    || isManutencao
  );
}

export const REGISTROS_POR_PAGINA = 20;

// Agrupa os tipos armazenados (ex.: "Retirada de Cobertor" / "Entrega de Cobertor")
// sob um rótulo único de filtro ("Cobertor").
export const GRUPOS_TIPO_REGISTRO = {
  Cobertor: ['Retirada de Cobertor', 'Entrega de Cobertor'],
  Toalha: ['Retirada de Toalha', 'Entrega de Toalha'],
  Documentos: ['Bipar documentos guardados', 'Bipar documentos retirados'],
  Bagageiro: ['Movimentação de Bagageiro'],
};

// Opções do seletor "Tipo de registro" do histórico.
export const TIPOS_REGISTRO_FILTRO = [
  { valor: '', label: 'Todos os tipos' },
  { valor: 'Entrada', label: 'Entrada' },
  { valor: 'Saída', label: 'Saída' },
  { valor: 'Café da manhã', label: 'Café da manhã' },
  { valor: 'Almoço', label: 'Almoço' },
  { valor: 'Jantar', label: 'Jantar' },
  { valor: 'Lanche noturno', label: 'Lanche noturno' },
  { valor: 'Banho', label: 'Banho' },
  { valor: 'Cobertor', label: 'Cobertor (retirada/entrega)' },
  { valor: 'Toalha', label: 'Toalha (retirada/entrega)' },
  { valor: 'Bagageiro', label: 'Bagageiro' },
  { valor: 'Documentos', label: 'Documentos (guardar/retirar)' },
];

// Valores reais usados na edição manual de um registro (sem agrupamento).
export const TIPOS_REGISTRO_EDICAO = [
  'Entrada',
  'Saída',
  'Café da manhã',
  'Almoço',
  'Jantar',
  'Lanche noturno',
  'Banho',
  'Retirada de Cobertor',
  'Entrega de Cobertor',
  'Retirada de Toalha',
  'Entrega de Toalha',
  'Movimentação de Bagageiro',
  'Bipar documentos guardados',
  'Bipar documentos retirados',
];

export function listarTiposRegistroFiltroRotina(_perfil, opcoes = TIPOS_REGISTRO_FILTRO) {
  return opcoes;
}

export function obterTotalResumoSemAlimentacao(resumoPeriodo, registros = []) {
  if (resumoPeriodo?.contagens_por_tipo) {
    const totalAlimentacao = TIPOS_ROTINA_REFEICOES.reduce(
      (acc, tipo) => acc + Number(resumoPeriodo.contagens_por_tipo?.[tipo] || 0),
      0,
    );
    return Math.max(0, Number(resumoPeriodo.total || 0) - totalAlimentacao);
  }

  return registros.filter((registro) => !tipoRegistroAlimentacao(registro.tipo_registro)).length;
}

export function tipoRegistroCorresponde(tipoRegistro, filtro) {
  if (!filtro) return true;
  const grupo = GRUPOS_TIPO_REGISTRO[filtro];
  if (grupo) return grupo.includes(tipoRegistro);
  return tipoRegistro === filtro;
}

export function rotuloTipoRegistroFiltro(filtro) {
  const item = TIPOS_REGISTRO_FILTRO.find((t) => t.valor === filtro);
  return item ? item.label : 'Todos os tipos';
}

export function contarRegistrosPorTipo(registros, filtro) {
  if (!filtro) return registros.length;
  return registros.reduce(
    (acc, registro) => acc + (tipoRegistroCorresponde(registro.tipo_registro, filtro) ? 1 : 0),
    0,
  );
}

export function obterContagemTipoResumo(contagensPorTipo, filtro) {
  if (!filtro) return 0;
  return Number(contagensPorTipo?.[filtro] || 0);
}

export function montarParamsFiltrosRotina({
  tipoFiltro,
  buscaFiltro,
  dataInicioFiltro,
  dataFimFiltro,
  statusFiltro,
  auditoriaFiltro,
}) {
  const params = {};

  if (tipoFiltro) params.tipo_registro = tipoFiltro;
  if (dataInicioFiltro) params.data_inicio = dataInicioFiltro;
  if (dataFimFiltro) params.data_fim = dataFimFiltro;
  if (buscaFiltro.trim()) params.busca = buscaFiltro.trim();
  if (statusFiltro) params.status_registro = statusFiltro;
  if (auditoriaFiltro === 'editados') params.apenas_editados = true;
  if (auditoriaFiltro === 'retorno_rapido') params.apenas_retorno_rapido = true;

  return params;
}

export function filtrarRegistrosRotina(registros, filtros) {
  const {
    tipoFiltro,
    buscaFiltro,
    dataInicioFiltro,
    dataFimFiltro,
    statusFiltro,
    auditoriaFiltro,
  } = filtros;

  return registros.filter((registro) => {
    if (tipoFiltro && !tipoRegistroCorresponde(registro.tipo_registro, tipoFiltro)) {
      return false;
    }

    if (buscaFiltro.trim()) {
      const conviventeBusca = {
        nome_social: registro.convivente_nome,
        nome_completo: registro.convivente_nome_completo || registro.convivente_nome,
        numero_institucional: registro.numero_institucional,
      };

      if (!conviventeCorrespondeBusca(conviventeBusca, buscaFiltro)) {
        return false;
      }
    }

    if (dataInicioFiltro) {
      const dataRegistro = new Date(registro.data_registro);
      const dataInicio = new Date(`${dataInicioFiltro}T00:00:00`);

      if (dataRegistro < dataInicio) return false;
    }

    if (dataFimFiltro) {
      const dataRegistro = new Date(registro.data_registro);
      const dataFim = new Date(`${dataFimFiltro}T23:59:59`);

      if (dataRegistro > dataFim) return false;
    }

    if (statusFiltro === 'ativos' && registro.cancelado) {
      return false;
    }

    if (statusFiltro === 'cancelados' && !registro.cancelado) {
      return false;
    }

    if (auditoriaFiltro === 'editados' && !registro.foi_editado) {
      return false;
    }

    if (auditoriaFiltro === 'retorno_rapido' && !registro.retorno_rapido) {
      return false;
    }

    return true;
  });
}

function conviventeDoRegistroRotina(registro) {
  return {
    nome_social: registro.convivente_nome,
    nome_completo: registro.convivente_nome_completo || registro.convivente_nome,
    numero_institucional: registro.numero_institucional,
  };
}

export function ordenarRegistrosRotina(registros, busca = '') {
  const termo = normalizarTextoBusca(busca);

  return [...registros].sort((a, b) => {
    if (termo) {
      const comparacaoBusca = compararConviventesPorBusca(
        conviventeDoRegistroRotina(a),
        conviventeDoRegistroRotina(b),
        busca,
      );

      if (comparacaoBusca !== 0) return comparacaoBusca;
    }

    return new Date(b.data_registro) - new Date(a.data_registro);
  });
}

export function resumirRegistrosRotina(registros) {
  return registros.reduce(
    (acc, registro) => {
      if (registro.tipo_registro === 'Entrada') acc.entradas += 1;
      if (registro.tipo_registro === 'Saída') acc.saidas += 1;
      if (registro.tipo_registro === 'Almoço') acc.almocos += 1;
      if (registro.retorno_rapido) acc.retornosRapidos += 1;
      if (registro.foi_editado) acc.editados += 1;
      if (registro.cancelado) acc.cancelados += 1;
      acc.total += 1;
      return acc;
    },
    {
      total: 0,
      entradas: 0,
      saidas: 0,
      almocos: 0,
      retornosRapidos: 0,
      editados: 0,
      cancelados: 0,
    },
  );
}

export function formatarDataHoraRotina(data) {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR');
}

export function montarObservacoesAuditoriaRegistro(registro) {
  return [
    registro.observacao ? `Complemento: ${registro.observacao}` : '',
    registro.justificativa_retorno_rapido ? `Justificativa: ${registro.justificativa_retorno_rapido}` : '',
    registro.motivo_edicao ? `Edição: ${registro.motivo_edicao}` : '',
    registro.motivo_cancelamento ? `Cancelamento: ${registro.motivo_cancelamento}` : '',
  ].filter(Boolean).join(' | ');
}

export function montarDadosImpressaoHistoricoRotina(registros) {
  return registros.map((registro) => ({
    'Data/Hora': formatarDataHoraRotina(registro.data_registro),
    Convivente: registro.convivente_nome || '-',
    Prontuário: `#${registro.numero_institucional || 'S/N'}`,
    Tipo: rotuloRepeticaoExtraRefeicao(registro.repeticao_extra_refeicao)
      ? `${registro.tipo_registro || '-'} · ${rotuloRepeticaoExtraRefeicao(registro.repeticao_extra_refeicao)}`
      : (registro.tipo_registro || '-'),
    Operador: registro.usuario_nome || '-',
    Status: `${registro.cancelado ? 'Cancelado' : 'Ativo'}${registro.foi_editado ? ' / Editado' : ''}${registro.retorno_rapido ? ' / Retorno rápido' : ''}`,
    'Observações/Auditoria': montarObservacoesAuditoriaRegistro(registro) || '-',
  }));
}

export function montarFiltrosTextoHistoricoRotina({
  tipoFiltro,
  dataInicioFiltro,
  dataFimFiltro,
  buscaFiltro,
  statusFiltro,
  auditoriaFiltro,
}) {
  return [
    tipoFiltro ? `Tipo: ${rotuloTipoRegistroFiltro(tipoFiltro)}` : '',
    dataInicioFiltro ? `Data inicial: ${formatarDataBr(dataInicioFiltro)}` : '',
    dataFimFiltro ? `Data final: ${formatarDataBr(dataFimFiltro)}` : '',
    buscaFiltro?.trim() ? `Busca: ${buscaFiltro.trim()}` : '',
    statusFiltro ? `Status: ${statusFiltro}` : '',
    auditoriaFiltro ? `Auditoria: ${auditoriaFiltro}` : '',
  ].filter(Boolean);
}

export function classeTipoRegistroRotina(tipo) {
  if (tipo === 'Entrada') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (tipo === 'Saída') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}
