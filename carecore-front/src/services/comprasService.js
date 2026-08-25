import api from './api';

export async function comprasAcesso() {
  const { data } = await api.get('/api/compras/me/acesso');
  return data;
}

export async function comprasAtivarModulo(ativo) {
  const { data } = await api.patch('/api/compras/modulo', { ativo });
  return data;
}

export async function comprasUnidades() {
  const { data } = await api.get('/api/compras/unidades');
  return data?.itens || [];
}

export async function comprasJanelas() {
  const { data } = await api.get('/api/compras/janelas');
  return {
    hoje: data?.hoje,
    itens: data?.itens || [],
  };
}

export async function comprasSugestaoJanela(competencia, semana) {
  const params = { competencia };
  if (semana) params.semana = semana;
  const { data } = await api.get('/api/compras/janela/sugestao', { params });
  return data;
}

export async function comprasSalvarJanela(payload) {
  const { data } = await api.post('/api/compras/janelas', payload);
  return data;
}

export async function comprasPublicarJanelasAno(ano, semana = 2) {
  const { data } = await api.post('/api/compras/janelas/ano', { ano, semana });
  return data;
}

export async function comprasExcluirJanela(janelaId) {
  const { data } = await api.delete(`/api/compras/janelas/${janelaId}`);
  return data;
}

export async function comprasLiberarUnidade(janelaId, payload) {
  const { data } = await api.post(`/api/compras/janelas/${janelaId}/liberar`, payload);
  return data;
}

export async function comprasCategorias() {
  const { data } = await api.get('/api/compras/categorias');
  return data?.itens || [];
}

export async function comprasSalvarCategoria(payload, id) {
  const { data } = id
    ? await api.put(`/api/compras/categorias/${id}`, payload)
    : await api.post('/api/compras/categorias', payload);
  return data;
}

export async function comprasFontes() {
  const { data } = await api.get('/api/compras/fontes');
  return data?.itens || [];
}

export async function comprasSalvarFonte(payload, id) {
  const { data } = id
    ? await api.put(`/api/compras/fontes/${id}`, payload)
    : await api.post('/api/compras/fontes', payload);
  return data;
}

export async function comprasFornecedores(params = {}) {
  const { data } = await api.get('/api/compras/fornecedores', { params });
  return data?.itens || [];
}

export async function comprasSalvarFornecedor(payload, id) {
  const { data } = id
    ? await api.put(`/api/compras/fornecedores/${id}`, payload)
    : await api.post('/api/compras/fornecedores', payload);
  return data;
}

export async function comprasPedidos(params = {}) {
  const { data } = await api.get('/api/compras/pedidos', { params });
  return data?.itens || [];
}

export async function comprasCriarPedido(payload) {
  const { data } = await api.post('/api/compras/pedidos', payload);
  return data;
}

export async function comprasAtualizarRascunho(id, payload) {
  const { data } = await api.patch(`/api/compras/pedidos/${id}`, payload);
  return data;
}

export async function comprasObterPedido(id) {
  const { data } = await api.get(`/api/compras/pedidos/${id}`);
  return data;
}

export async function comprasSalvarItens(id, itens) {
  const { data } = await api.put(`/api/compras/pedidos/${id}/itens`, { itens });
  return data;
}

export async function comprasSubmeter(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/submeter`);
  return data;
}

export async function comprasCotacao(id, payload) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/cotacoes`, payload);
  return data;
}

export async function comprasEscolherCotacao(pedidoId, cotacaoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/cotacoes/${cotacaoId}/escolher`);
  return data;
}

export async function comprasAprovarUnidade(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/aprovar-unidade`);
  return data;
}

export async function comprasAprovarSede(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/aprovar-sede`);
  return data;
}

export async function comprasAssinarOrcamentoSede(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/assinar-orcamento-sede`);
  return data;
}

export async function comprasEnviar(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/enviar`);
  return data;
}

export async function comprasReceber(id, payload) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/receber`, payload);
  return data;
}

export async function comprasCancelar(id, motivo) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/cancelar`, { motivo });
  return data;
}

export async function comprasExcluirRascunho(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/excluir`);
  return data;
}

export async function comprasReprovar(id, motivo) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/reprovar`, { motivo });
  return data;
}

export async function comprasReabrir(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/reabrir`);
  return data;
}

export async function comprasComunicacao(id, payload) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/comunicacao`, payload);
  return data;
}

export async function comprasConfirmarRevisaoItens(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/itens-revisados`);
  return data;
}

export async function comprasConfirmarEvento(pedidoId, eventoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/eventos/${eventoId}/confirmar`);
  return data;
}

export async function comprasAnexarArquivo(id, formData) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/anexos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasRegistrarNotaFiscal(id, formData) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/notas-fiscais`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasGerarPedidoCompra(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/gerar-pedido-compra`);
  return data;
}

export async function comprasEnviarEmailFornecedor(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/enviar-email`);
  return data;
}

export async function comprasSolicitarCotacao(id, fornecedorIds) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/solicitar-cotacao`, {
    fornecedor_ids: fornecedorIds,
  });
  return data;
}

export async function comprasDesativarCotacao(pedidoId, cotacaoId, motivo) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/cotacoes/${cotacaoId}/desativar`, { motivo });
  return data;
}

export function urlAnexoPedido(pedidoId, anexoId) {
  return `${api.defaults.baseURL}/api/compras/pedidos/${pedidoId}/anexos/${anexoId}/arquivo`;
}

export async function comprasBaixarAnexo(pedidoId, anexoId, nomeArquivo) {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const resposta = await fetch(urlAnexoPedido(pedidoId, anexoId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
  const blob = await resposta.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo || 'anexo';
  link.target = '_blank';
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function comprasPatrimonio() {
  const { data } = await api.get('/api/compras/patrimonio');
  return data?.itens || [];
}

export async function comprasSalvarPatrimonio(payload, id) {
  const { data } = id
    ? await api.put(`/api/compras/patrimonio/${id}`, payload)
    : await api.post('/api/compras/patrimonio', payload);
  return data;
}

export async function comprasItensConsumo(params = {}) {
  const { data } = await api.get('/api/compras/itens-consumo', { params });
  return data?.itens || [];
}

export async function comprasSalvarItemConsumo(payload, id) {
  const { data } = id
    ? await api.put(`/api/compras/itens-consumo/${id}`, payload)
    : await api.post('/api/compras/itens-consumo', payload);
  return data;
}

export async function comprasImportarItensConsumo(arquivo) {
  const form = new FormData();
  form.append('arquivo', arquivo);
  const { data } = await api.post('/api/compras/itens-consumo/importar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasEconomia(competencia) {
  const params = competencia ? { competencia } : {};
  const { data } = await api.get('/api/compras/economia', { params });
  return data;
}

export function moneyCentavos(centavos) {
  return (Number(centavos || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function competenciaAtual() {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
