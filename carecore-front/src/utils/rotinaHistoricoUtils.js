export const REGISTROS_POR_PAGINA = 20;

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
    if (tipoFiltro && registro.tipo_registro !== tipoFiltro) {
      return false;
    }

    if (buscaFiltro.trim()) {
      const termo = buscaFiltro.trim().toLowerCase();
      const nome = String(registro.convivente_nome || '').toLowerCase();
      const prontuario = String(registro.numero_institucional || '').toLowerCase();

      if (!nome.includes(termo) && !prontuario.includes(termo)) {
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

export function ordenarRegistrosRotina(registros) {
  return [...registros].sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
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

export function classeTipoRegistroRotina(tipo) {
  if (tipo === 'Entrada') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (tipo === 'Saída') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}
