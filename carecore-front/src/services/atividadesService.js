import api from './api';

export async function listarAtividades(somenteAtivas = true) {
  const response = await api.get('/api/atividades', {
    params: { somente_ativas: somenteAtivas },
  });
  return response.data;
}

export async function obterAtividade(atividadeId) {
  const response = await api.get(`/api/atividades/${atividadeId}`);
  return response.data;
}

export async function criarAtividade(payload) {
  const response = await api.post('/api/atividades', payload);
  return response.data;
}

export async function atualizarAtividade(atividadeId, payload) {
  const response = await api.put(`/api/atividades/${atividadeId}`, payload);
  return response.data;
}

export async function excluirAtividade(atividadeId) {
  const response = await api.delete(`/api/atividades/${atividadeId}`);
  return response.data;
}

export async function gerarOcorrenciasAtividade(atividadeId, mesReferencia) {
  const response = await api.post(`/api/atividades/${atividadeId}/gerar-ocorrencias`, {
    mes_referencia: mesReferencia,
  });
  return response.data;
}

export async function listarOcorrenciasAtividade(atividadeId, mesReferencia) {
  const response = await api.get(`/api/atividades/${atividadeId}/ocorrencias`, {
    params: { mes_referencia: mesReferencia },
  });
  return response.data;
}

export async function obterChamadaAtividade(ocorrenciaId) {
  const response = await api.get(`/api/atividades/ocorrencias/${ocorrenciaId}/chamada`);
  return response.data;
}

export async function registrarPresencaAtividade(ocorrenciaId, payload) {
  const response = await api.post(`/api/atividades/ocorrencias/${ocorrenciaId}/presencas`, payload);
  return response.data;
}

export async function desfazerPresencaAtividade(presencaId) {
  const response = await api.patch(`/api/atividades/presencas/${presencaId}/desfazer`);
  return response.data;
}

export async function cancelarPresencaAtividade(presencaId, motivo) {
  const response = await api.patch(`/api/atividades/presencas/${presencaId}/cancelar`, {
    motivo_cancelamento: motivo,
  });
  return response.data;
}

export async function obterGradeAtividade(atividadeId, mesReferencia) {
  const response = await api.get(`/api/atividades/${atividadeId}/grade`, {
    params: { mes_referencia: mesReferencia },
  });
  return response.data;
}

export async function obterConteudoSessaoAtividade(ocorrenciaId) {
  const response = await api.get(`/api/atividades/ocorrencias/${ocorrenciaId}/conteudo`);
  return response.data;
}

export async function salvarConteudoSessaoAtividade(ocorrenciaId, acoesRealizadas) {
  const response = await api.put(`/api/atividades/ocorrencias/${ocorrenciaId}/conteudo`, {
    acoes_realizadas: acoesRealizadas,
  });
  return response.data;
}

export async function obterMetaAtividades() {
  const response = await api.get('/api/atividades/meta/opcoes');
  return response.data;
}

export async function obterRelatorioAtividades(params = {}) {
  const response = await api.get('/api/atividades/relatorios', { params });
  return response.data;
}

export async function atualizarStatusOcorrenciaAtividade(ocorrenciaId, status) {
  const response = await api.patch(`/api/atividades/ocorrencias/${ocorrenciaId}/status`, { status });
  return response.data;
}

export async function obterCatalogoSisaAtividades() {
  const response = await api.get('/api/atividades/sisa/catalogo');
  return response.data;
}

export async function adicionarCatalogoSisaAtividade(tipo, valor) {
  const response = await api.post('/api/atividades/sisa/catalogo', { tipo, valor });
  return response.data;
}

export async function conferirAtividadesSisa(arquivo, vinculos = [], salvarVinculos = true, salvarHistorico = true) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('vinculos_json', JSON.stringify(vinculos));
  formData.append('salvar_vinculos', salvarVinculos ? 'true' : 'false');
  formData.append('salvar_historico', salvarHistorico ? 'true' : 'false');
  const response = await api.post('/api/atividades/sisa/conferencia', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function listarHistoricoConferenciasSisa(limit = 24, offset = 0) {
  const response = await api.get('/api/atividades/sisa/conferencias/historico', {
    params: { limit, offset },
  });
  return response.data;
}

export async function obterHistoricoConferenciaSisa(historicoId) {
  const response = await api.get(`/api/atividades/sisa/conferencias/historico/${historicoId}`);
  return response.data;
}

export async function excluirHistoricoConferenciaSisa(historicoId) {
  const response = await api.delete(`/api/atividades/sisa/conferencias/historico/${historicoId}`);
  return response.data;
}

export async function obterRankingPontosAtividades(params = {}) {
  const response = await api.get('/api/atividades/pontos/ranking', { params });
  return response.data;
}

export async function listarResgatesPontosAtividades(params = {}) {
  const response = await api.get('/api/atividades/pontos/resgates', { params });
  return response.data;
}

export async function registrarResgatePontosAtividades(payload) {
  const response = await api.post('/api/atividades/pontos/resgates', payload);
  return response.data;
}
