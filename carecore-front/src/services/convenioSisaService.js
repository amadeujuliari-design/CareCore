import api from './api';

const BASE_CONVENIO_SISA = '/api/convenio-sisa';

export async function buscarRelatorioDiarioSisa({ data }) {
  const response = await api.get(`${BASE_CONVENIO_SISA}/diario`, {
    params: { data },
  });
  return response.data;
}

export async function buscarFechamentosSisa() {
  const response = await api.get(`${BASE_CONVENIO_SISA}/fechamentos`);
  return response.data || [];
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

export async function listarImportacoesSisa() {
  const response = await api.get(`${BASE_CONVENIO_SISA}/importacoes`);
  return response.data || [];
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
