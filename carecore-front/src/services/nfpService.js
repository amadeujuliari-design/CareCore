import api from './api';

export async function nfpAcesso() {
  const { data } = await api.get('/api/nfp/me/acesso');
  return data;
}

export async function nfpDashboard(competencia, agente) {
  const params = {};
  if (competencia) params.competencia = competencia;
  // '' / undefined => visão Todos; backend aceita TODOS
  if (agente === '' || agente == null) params.agente = 'TODOS';
  else params.agente = agente;
  const { data } = await api.get('/api/nfp/dashboard', { params });
  return data;
}

export async function nfpListarDoadores(params = {}) {
  const { data } = await api.get('/api/nfp/doadores', { params });
  return data;
}

export async function nfpCriarDoador(payload) {
  const { data } = await api.post('/api/nfp/doadores', payload);
  return data;
}

export async function nfpObterDoador(id) {
  const { data } = await api.get(`/api/nfp/doadores/${id}`);
  return data;
}

export async function nfpAtualizarDoador(id, payload) {
  const { data } = await api.put(`/api/nfp/doadores/${id}`, payload);
  return data;
}

export async function nfpSincronizarDoadores(competencia) {
  const params = {};
  if (competencia) params.competencia = competencia;
  const { data } = await api.post('/api/nfp/doadores/sincronizar', null, {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function nfpImportarDoadores(arquivo) {
  const form = new FormData();
  form.append('arquivo', arquivo);
  const { data } = await api.post('/api/nfp/doadores/importar', form);
  return data;
}

export async function nfpListarCnpjs(params = {}) {
  const { data } = await api.get('/api/nfp/cnpjs', { params });
  return data;
}

export async function nfpCriarCnpj(payload) {
  const { data } = await api.post('/api/nfp/cnpjs', payload);
  return data;
}

export async function nfpObterCnpj(id) {
  const { data } = await api.get(`/api/nfp/cnpjs/${id}`);
  return data;
}

export async function nfpAtualizarCnpj(id, payload) {
  const { data } = await api.put(`/api/nfp/cnpjs/${id}`, payload);
  return data;
}

export async function nfpListarCpfsCaptados(params = {}) {
  const { data } = await api.get('/api/nfp/cpfs-captados', { params });
  return data;
}

export async function nfpCriarCpfCaptado(payload) {
  const { data } = await api.post('/api/nfp/cpfs-captados', payload);
  return data;
}

export async function nfpObterCpfCaptado(id) {
  const { data } = await api.get(`/api/nfp/cpfs-captados/${id}`);
  return data;
}

export async function nfpAtualizarCpfCaptado(id, payload) {
  const { data } = await api.put(`/api/nfp/cpfs-captados/${id}`, payload);
  return data;
}

export async function nfpListarAgentes(params = {}) {
  const { data } = await api.get('/api/nfp/agentes', { params });
  return data;
}

export async function nfpObterAgente(id) {
  const { data } = await api.get(`/api/nfp/agentes/${id}`);
  return data;
}

export async function nfpCriarAgente(payload) {
  const { data } = await api.post('/api/nfp/agentes', payload);
  return data;
}

export async function nfpAtualizarAgente(id, payload) {
  const { data } = await api.put(`/api/nfp/agentes/${id}`, payload);
  return data;
}

export async function nfpGarantirAgentesPadrao() {
  const { data } = await api.post('/api/nfp/agentes/garantir-padrao');
  return data;
}

export async function nfpImportarCnpjs(arquivo, captadorPadrao = 'DIEGO', competencia) {
  const form = new FormData();
  form.append('arquivo', arquivo);
  form.append('captador_padrao', captadorPadrao);
  if (competencia) form.append('competencia', competencia);
  const { data } = await api.post('/api/nfp/cnpjs/importar', form);
  return data;
}

export async function nfpImportarDoacoes(arquivo, competencia) {
  const form = new FormData();
  form.append('arquivo', arquivo);
  if (competencia) form.append('competencia', competencia);
  const { data } = await api.post('/api/nfp/importar/doacoes-sefaz', form);
  return data;
}

export async function nfpImportarSefaz(arquivos, competencia) {
  const form = new FormData();
  const lista = Array.isArray(arquivos) ? arquivos : [arquivos];
  lista.filter(Boolean).forEach((arquivo) => form.append('arquivos', arquivo));
  if (competencia) form.append('competencia', competencia);
  const { data } = await api.post('/api/nfp/importar/sefaz-creditos', form);
  return data;
}

export async function nfpCalcularRateio(competencia) {
  const form = new FormData();
  form.append('competencia', competencia);
  const { data } = await api.post('/api/nfp/rateio/calcular', form);
  return data;
}

export async function nfpListarRateio(competencia, params = {}) {
  const { data } = await api.get('/api/nfp/rateio', {
    params: { competencia, ...params },
  });
  return data;
}

export async function nfpExportarRateio(competencia) {
  const response = await api.get('/api/nfp/rateio/exportar', {
    params: { competencia },
    responseType: 'blob',
  });
  return response.data;
}

export async function nfpListarBatimentos(competencia, params = {}) {
  const { data } = await api.get('/api/nfp/batimentos', {
    params: { competencia, ...params },
  });
  return data;
}

export async function nfpListarCupons(params = {}) {
  const { data } = await api.get('/api/nfp/cupons', { params });
  return data;
}

export async function nfpRegistrarLeituraCupom(payload) {
  const { data } = await api.post('/api/nfp/cupons/leitura', payload);
  return data;
}

export async function nfpAtualizarStatusCupom(id, payload) {
  const { data } = await api.patch(`/api/nfp/cupons/${id}/status`, payload);
  return data;
}

export async function nfpEnvioSefazStatus() {
  const { data } = await api.get('/api/nfp/envio-sefaz/status');
  return data;
}

export async function nfpEnvioSefazAbrirChrome() {
  const { data } = await api.post('/api/nfp/envio-sefaz/abrir-chrome');
  return data;
}

export async function nfpEnvioSefazEnviarFila(payload = {}) {
  const { data } = await api.post('/api/nfp/envio-sefaz/enviar-fila', payload);
  return data;
}

export async function nfpEnvioSefazParar() {
  const { data } = await api.post('/api/nfp/envio-sefaz/parar');
  return data;
}

export async function nfpObterMetas(competencia, params = {}) {
  const { data } = await api.get(`/api/nfp/metas/${competencia}`, { params });
  return data;
}

export async function nfpSalvarMetas(competencia, payload) {
  const { data } = await api.put(`/api/nfp/metas/${competencia}`, payload);
  return data;
}

export async function nfpSugerirMetasRateio(competencia, sobrescrever = false) {
  const { data } = await api.post(`/api/nfp/metas/${competencia}/sugerir-rateio`, null, {
    params: { sobrescrever },
  });
  return data;
}

export async function nfpListarMetasCompetencias() {
  const { data } = await api.get('/api/nfp/metas/competencias');
  return data;
}

export async function nfpMetasConsolidado(competencias) {
  const params = {};
  if (competencias?.length) params.competencias = competencias.join(',');
  const { data } = await api.get('/api/nfp/metas/consolidado', { params });
  return data;
}

export async function nfpExportarMetas(competencia) {
  const { data } = await api.get(`/api/nfp/metas/${competencia}/exportar`, {
    responseType: 'blob',
  });
  return data;
}

export async function listarAdmGlobalOrganizacao(params = {}) {
  const { data } = await api.get('/api/usuarios/organizacao/adm-global', { params });
  return data;
}

export async function listarVinculosNfpOrganizacao() {
  const { data } = await api.get('/api/usuarios/organizacao/vinculos-nfp');
  return data?.itens || [];
}

export async function criarAdmGlobalOrganizacao(payload) {
  const { data } = await api.post('/api/usuarios/organizacao/adm-global', payload);
  return data;
}

export async function editarAdmGlobalOrganizacao(usuarioId, payload) {
  const { data } = await api.put(`/api/usuarios/organizacao/adm-global/${usuarioId}`, payload);
  return data;
}

export async function statusAdmGlobalOrganizacao(usuarioId, payload) {
  const { data } = await api.patch(
    `/api/usuarios/organizacao/adm-global/${usuarioId}/status`,
    payload,
  );
  return data;
}
