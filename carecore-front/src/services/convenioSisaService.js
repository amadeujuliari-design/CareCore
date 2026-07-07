import api from './api';

const BASE_CONVENIO_SISA = '/api/convenio-sisa';

export async function buscarRelatorioDiarioSisa({ data }) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/diario`, {
    params: { data },
  });
  return response.data;
}

export async function buscarFechamentosSisa(params = {}) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/fechamentos`, {
    params: {
      limit: params.limit ?? 60,
      offset: params.offset ?? 0,
    },
  });
  const data = response.data;
  if (Array.isArray(data)) {
    return { items: data, total: data.length, has_more: false };
  }
  return {
    items: data?.items || [],
    total: data?.total ?? (data?.items || []).length,
    has_more: Boolean(data?.has_more),
  };
}

export async function buscarRelatorioMensalSisa({ ano, mes, dataInicio, dataFim }) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/mensal`, {
    params: {
      ano,
      mes,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
  });
  return response.data;
}

export async function listarImportacoesSisa(params = {}) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/importacoes`, {
    params: {
      limit: params.limit ?? 30,
      offset: params.offset ?? 0,
    },
  });
  const data = response.data;
  if (Array.isArray(data)) {
    return { items: data, total: data.length, has_more: false };
  }
  return {
    items: data?.items || [],
    total: data?.total ?? (data?.items || []).length,
    has_more: Boolean(data?.has_more),
  };
}

export async function listarDivergenciasImportacaoSisa(importacaoId, params = {}) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/importacoes/${importacaoId}/divergencias`, {
    params,
  });
  return response.data;
}

const LIMITE_DIVERGENCIAS_SISA_API = 200;

/** Busca todas as divergências paginando dentro do limite aceito pela API (200). */
export async function listarTodasDivergenciasImportacaoSisa(importacaoId, params = {}) {
  const itens = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const resposta = await listarDivergenciasImportacaoSisa(importacaoId, {
      ...params,
      limit: LIMITE_DIVERGENCIAS_SISA_API,
      offset,
    });
    const pagina = resposta?.items || [];
    itens.push(...pagina);
    hasMore = Boolean(resposta?.has_more) && pagina.length > 0;
    offset += pagina.length;
    if (pagina.length < LIMITE_DIVERGENCIAS_SISA_API) {
      break;
    }
  }

  return itens;
}

export async function buscarDetalheImportacaoSisa(importacaoId) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/importacoes/${importacaoId}`);
  return response.data;
}

export async function excluirImportacaoSisa(importacaoId) {
  const response = await api.delete(`${BASE_CONVENIO_SISA}/importacoes/${importacaoId}`);
  return response.data;
}

export async function importarPlanilhaConvenioSisa(formData) {
  const response = await api.post(
    `${BASE_CONVENIO_SISA}/importacoes`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function previsualizarImportacaoConvenioSisa(formData) {
  const response = await api.post(
    `${BASE_CONVENIO_SISA}/importacoes/previsualizar`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function atualizarTratativaDivergenciaSisa(divergenciaId, status) {
  const response = await api.patch(
    `${BASE_CONVENIO_SISA}/divergencias/${divergenciaId}`,
    { status },
  );
  return response.data;
}

export async function exportarMensalSisaXlsx({ ano, mes, tipoAtendimento, dataInicio, dataFim }) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/mensal/exportar-xlsx`, {
    params: {
      ano,
      mes,
      tipo_atendimento: tipoAtendimento,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
    responseType: 'blob',
  });
  return response.data;
}

export async function fecharMesSisa({ ano, mes, observacoes }) {
  const response = await api.post(`${BASE_CONVENIO_SISA}/fechar-mes`, {
    ano,
    mes,
    observacoes,
  });
  return response.data;
}

export async function reabrirMesSisa({ fechamentoId, motivoReabertura }) {
  const response = await api.patch(`${BASE_CONVENIO_SISA}/fechamentos/${fechamentoId}/reabrir`, {
    motivo_reabertura: motivoReabertura,
  });
  return response.data;
}
