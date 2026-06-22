import api from './api';

export async function carregarDadosIniciaisProntuario() {
  const [conviventes, quartos, tecnicos, motivos, origens, identidade] = await Promise.all([
    api.get('/api/conviventes/resumo'),
    api.get('/api/quartos'),
    api.get('/api/tecnicos'),
    api.get('/api/motivos-inteligentes'),
    api.get('/api/origens-encaminhamento'),
    api.get('/api/organizacao/identidade-relatorios').catch(() => ({ data: null })),
  ]);

  return {
    conviventes: conviventes.data || [],
    quartos: quartos.data || [],
    tecnicos: tecnicos.data || [],
    motivos: motivos.data || [],
    origens: origens.data || [],
    identidade: identidade.data || null,
  };
}

export async function obterConviventeProntuario(conviventeId) {
  const response = await api.get(`/api/conviventes/${conviventeId}`);
  return response.data;
}

export async function listarOcorrenciasConvivente(conviventeId, params = {}) {
  const response = await api.get(`/api/conviventes/${conviventeId}/ocorrencias`, { params });
  return response.data || { registros: [], total: 0, limite: 0, deslocamento: 0 };
}

export async function listarHistoricosConvivente(conviventeId, params = {}) {
  const response = await api.get(`/api/conviventes/${conviventeId}/historicos`, { params });
  return response.data || { registros: [], total: 0, limite: 0, deslocamento: 0 };
}

export async function listarHistoricoFluxoConvivente(conviventeId, params = {}) {
  const response = await api.get('/api/rotina/historico', {
    params: {
      ...params,
      convivente_id: conviventeId,
    },
  });
  const data = response.data;
  if (Array.isArray(data)) {
    return {
      registros: data,
      total: data.length,
      has_more: false,
    };
  }
  return {
    registros: data?.registros || [],
    total: data?.total || 0,
    has_more: Boolean(data?.has_more),
  };
}

export async function listarRegistrosPiaConvivente(conviventeId, params = {}) {
  const response = await api.get(`/api/conviventes/${conviventeId}/pia`, { params });
  const data = response.data;
  if (Array.isArray(data)) {
    return {
      registros: data,
      total: data.length,
      has_more: false,
    };
  }
  return {
    registros: data?.registros || [],
    total: data?.total || 0,
    has_more: Boolean(data?.has_more),
  };
}

export async function listarDocumentosConvivente(conviventeId, params = {}) {
  const response = await api.get(`/api/conviventes/${conviventeId}/documentos`, { params });
  const data = response.data;
  if (Array.isArray(data)) {
    return {
      registros: data,
      total: data.length,
      has_more: false,
    };
  }
  return {
    registros: data?.registros || [],
    total: data?.total || 0,
    has_more: Boolean(data?.has_more),
  };
}

export async function uploadDocumentoConvivente(conviventeId, formUpload) {
  const response = await api.post(
    `/api/conviventes/${conviventeId}/documentos`,
    formUpload,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function excluirDocumentoConvivente(documentoId) {
  const response = await api.delete(`/api/documentos/${documentoId}`);
  return response.data;
}

export async function salvarRegistroPiaConvivente(conviventeId, payload) {
  const response = await api.post(`/api/conviventes/${conviventeId}/pia`, payload);
  return response.data;
}

export async function salvarHistoricoConvivente(conviventeId, payload, historicoId = null) {
  const response = historicoId
    ? await api.put(`/api/conviventes/${conviventeId}/historicos/${historicoId}`, payload)
    : await api.post(`/api/conviventes/${conviventeId}/historicos`, payload);

  return response.data;
}

export async function excluirHistoricoConviventeApi(conviventeId, historicoId) {
  const response = await api.delete(`/api/conviventes/${conviventeId}/historicos/${historicoId}`);
  return response.data;
}

export async function removerFotoPerfilConvivente(conviventeId) {
  const response = await api.delete(`/api/conviventes/${conviventeId}/foto-perfil`);
  return response.data;
}

export async function criarConviventeProntuario(payload) {
  const response = await api.post('/api/conviventes', payload);
  return response.data;
}

export async function atualizarConviventeProntuario(conviventeId, payload) {
  const response = await api.put(`/api/conviventes/${conviventeId}`, payload);
  return response.data;
}

export async function excluirConviventeSemVinculos(conviventeId) {
  const response = await api.delete(`/api/conviventes/${conviventeId}`);
  return response.data;
}
