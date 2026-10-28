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

export async function comprasExcluirCategoria(id) {
  const { data } = await api.delete(`/api/compras/categorias/${id}`);
  return data;
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

export async function comprasSubmeter(id, { confirmarSemTresOrcamentos = false } = {}) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/submeter`, null, {
    params: confirmarSemTresOrcamentos ? { confirmar_sem_tres_orcamentos: true } : undefined,
  });
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

export async function comprasRevogarEscolhaCotacao(pedidoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/cotacoes/revogar-escolha`);
  return data;
}

export async function comprasFilaAssinaturaResumo() {
  const { data } = await api.get('/api/compras/fila-assinatura/resumo');
  return data;
}

export async function comprasAlertasContratoAssinado() {
  const { data } = await api.get('/api/compras/alertas-contrato-assinado');
  return data;
}

export async function comprasFilaAssinatura() {
  const { data } = await api.get('/api/compras/fila-assinatura');
  return data;
}

export async function comprasFilaConcluidosInfraResumo() {
  const { data } = await api.get('/api/compras/fila-concluidos-infra/resumo');
  return data;
}

export async function comprasFilaConcluidosInfra() {
  const { data } = await api.get('/api/compras/fila-concluidos-infra');
  return data;
}

export async function comprasFilaNfPagamentoResumo() {
  const { data } = await api.get('/api/compras/fila-nf-pagamento/resumo');
  return data;
}

export async function comprasFilaNfPagamento() {
  const { data } = await api.get('/api/compras/fila-nf-pagamento');
  return data;
}

export async function comprasFilaNfPagamentoSuprimentosResumo() {
  const { data } = await api.get('/api/compras/fila-nf-pagamento-suprimentos/resumo');
  return data;
}

export async function comprasFilaNfPagamentoSuprimentos() {
  const { data } = await api.get('/api/compras/fila-nf-pagamento-suprimentos');
  return data;
}

export async function comprasFilaExtratoResumo() {
  const { data } = await api.get('/api/compras/fila-extrato/resumo');
  return data;
}

export async function comprasEnviarEmergenciaPagamento(pedidoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/enviar-pagamento`);
  return data;
}

export async function comprasConfirmarNfPagamento(pedidoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/confirmar-nf-pagamento`);
  return data;
}

export async function comprasOkFinalInfra(pedidoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/ok-final-infra`);
  return data;
}

export async function comprasEmailNotasPendentes(pedidoId, payload = {}) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/email-notas-pendentes`, payload);
  return data;
}

export async function comprasDocumentosAssinados() {
  const { data } = await api.get('/api/compras/documentos-assinados');
  return data;
}

export async function comprasSubstituirContratoAssinado(pedidoId, anexoId, arquivo) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const { data } = await api.post(
    `/api/compras/pedidos/${pedidoId}/contratos/${anexoId}/substituir`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function comprasEnviarFilaRepresentante(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/fila-representante`);
  return data;
}

export async function comprasAssinaturaEletronicaGestor() {
  const { data } = await api.get('/api/compras/assinatura-eletronica-gestor');
  return data;
}

export async function comprasAssinaturaDigitalStatus() {
  const { data } = await api.get('/api/compras/assinatura-digital');
  return data;
}

export async function comprasUploadAssinaturaDigital(file) {
  const fd = new FormData();
  fd.append('arquivo', file);
  const { data } = await api.post('/api/compras/assinatura-digital', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

export async function comprasArquivarOrcamentoGovBr(pedidoId, arquivo) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/orcamento-govbr`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasAssinarOrcamentoSede(id, posicao = null) {
  const body = posicao && posicao.width != null
    ? {
      page: posicao.page ?? 0,
      x: posicao.x,
      y: posicao.y,
      width: posicao.width,
      height: posicao.height,
    }
    : {};
  const { data } = await api.post(`/api/compras/pedidos/${id}/assinar-orcamento-sede`, body);
  return data;
}

export async function comprasBlobAnexo(pedidoId, anexoId) {
  const { blob } = await comprasAbrirAnexoBlob(pedidoId, anexoId);
  return blob;
}

export async function comprasBlobAssinaturaDigital() {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const base = api.defaults.baseURL || '';
  const resposta = await fetch(`${base}/api/compras/assinatura-digital/arquivo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resposta.ok) throw new Error('Não foi possível abrir a assinatura digital.');
  return resposta.blob();
}

export async function comprasEnviar(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/enviar`);
  return data;
}

export async function comprasCompraDireta(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/compra-direta`);
  return data;
}

export async function comprasRegistrarSemContrato(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/sem-contrato`);
  return data;
}

export async function comprasReceber(id, payload) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/receber`, payload);
  return data;
}

export async function comprasDefinirPagamento(id, qtdParcelas) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/pagamento`, { qtd_parcelas: qtdParcelas });
  return data;
}

export async function comprasQuitarPagamento(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/pagamento/quitar`);
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

export async function comprasExcluirCancelado(id) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/excluir-cancelado`);
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

export async function comprasReabrirAprovado(id, motivo) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/reabrir-aprovado`, { motivo });
  return data;
}

export async function comprasComunicacao(id, payload) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/comunicacao`, payload);
  return data;
}

export async function comprasEditarEvento(pedidoId, eventoId, texto) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/eventos/${eventoId}`, { texto });
  return data;
}

export async function comprasCopiarPedido(pedidoId, modo) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/copiar`, { modo });
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

export async function comprasRevisarContrato(pedidoId, anexoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/contratos/${anexoId}/revisar`);
  return data;
}

export async function comprasContratoAssinado(pedidoId, anexoId, formData) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/contratos/${anexoId}/assinado`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasAnexarArquivo(id, formData) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/anexos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function comprasRemoverNotaFiscal(pedidoId, notaId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/notas-fiscais/${notaId}/remover`);
  return data;
}

export async function comprasRegistrarImpressaoNf(id, { encerrar = false } = {}) {
  const { data } = await api.post(`/api/compras/pedidos/${id}/nf-impressa`, null, {
    params: { encerrar: encerrar ? 'true' : 'false' },
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

export async function comprasEnviarEmailFornecedor(id, corpo, fornecedorId) {
  const payload = {};
  if (corpo != null) payload.corpo = corpo;
  if (fornecedorId) payload.fornecedor_id = fornecedorId;
  const { data } = await api.post(`/api/compras/pedidos/${id}/enviar-email`, payload);
  return data;
}

export async function comprasSolicitarCotacao(id, fornecedorIds, corpo) {
  const payload = { fornecedor_ids: fornecedorIds };
  if (corpo != null) payload.corpo = corpo;
  const { data } = await api.post(`/api/compras/pedidos/${id}/solicitar-cotacao`, payload);
  return data;
}

export async function comprasRascunhoEmail(id, tipo) {
  const { data } = await api.get(`/api/compras/pedidos/${id}/rascunho-email`, {
    params: { tipo },
  });
  return data;
}

export async function comprasDesativarCotacao(pedidoId, cotacaoId, motivo) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/cotacoes/${cotacaoId}/desativar`, { motivo });
  return data;
}

export async function comprasRemoverAnexo(pedidoId, anexoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/anexos/${anexoId}/remover`);
  return data;
}

export function urlAnexoPedido(pedidoId, anexoId) {
  return `${api.defaults.baseURL}/api/compras/pedidos/${pedidoId}/anexos/${anexoId}/arquivo`;
}

/** Abre o anexo em blob (pré-visualização). Não dispara download. */
export async function comprasAbrirAnexoBlob(pedidoId, anexoId) {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const resposta = await fetch(urlAnexoPedido(pedidoId, anexoId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
  const buffer = await resposta.arrayBuffer();
  const headerTipo = (resposta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const contentType = _inferirContentTypeAnexo(buffer, headerTipo);
  const blob = new Blob([buffer], { type: contentType });
  return {
    url: URL.createObjectURL(blob),
    contentType,
    blob,
    tamanho: buffer.byteLength,
  };
}

export async function comprasBaixarAnexo(pedidoId, anexoId, nomeArquivo) {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const resposta = await fetch(urlAnexoPedido(pedidoId, anexoId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
  const buffer = await resposta.arrayBuffer();
  const headerTipo = (resposta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const contentType = _inferirContentTypeAnexo(buffer, headerTipo);
  const blob = new Blob([buffer], { type: contentType });
  const nome = _nomeArquivoDownload(nomeArquivo, contentType, anexoId);
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = nome;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function _inferirContentTypeAnexo(buffer, headerTipo) {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  const asText = String.fromCharCode(...bytes.slice(0, 5));
  if (asText.startsWith('%PDF')) return 'application/pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (asText.startsWith('GIF8')) return 'image/gif';
  if (
    headerTipo
    && headerTipo !== 'application/octet-stream'
    && headerTipo !== 'binary/octet-stream'
  ) {
    return headerTipo;
  }
  return headerTipo || 'application/octet-stream';
}

function _nomeArquivoDownload(nomeArquivo, contentType, anexoId) {
  let nome = String(nomeArquivo || '').trim();
  if (!nome || /^[0-9a-f-]{36}$/i.test(nome)) {
    nome = contentType === 'application/pdf' ? 'anexo.pdf' : 'anexo';
  }
  if (contentType === 'application/pdf' && !/\.pdf$/i.test(nome)) {
    nome = `${nome}.pdf`;
  }
  if (contentType.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(nome)) {
    const ext = contentType.split('/')[1] || 'img';
    nome = `${nome}.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return nome || `anexo-${String(anexoId || 'arquivo').slice(0, 8)}`;
}

export async function comprasLiberarEscolha(pedidoId) {
  const { data } = await api.post(`/api/compras/pedidos/${pedidoId}/liberar-escolha`);
  return data;
}

export async function comprasPatrimonio() {
  const { data } = await api.get('/api/compras/patrimonio');
  return data?.itens || [];
}

export async function comprasAnexarPatrimonio(id, arquivo, tipo = 'outro') {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (tipo) formData.append('tipo', tipo);
  const { data } = await api.post(`/api/compras/patrimonio/${id}/anexos`, formData);
  return data;
}

export async function comprasBaixarAnexoPatrimonio(itemId, anexoId, nomeArquivo) {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const resposta = await fetch(
    `${api.defaults.baseURL}/api/compras/patrimonio/${itemId}/anexos/${anexoId}/arquivo`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
  const buffer = await resposta.arrayBuffer();
  const headerTipo = (resposta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const contentType = _inferirContentTypeAnexo(buffer, headerTipo);
  const blob = new Blob([buffer], { type: contentType });
  const nome = _nomeArquivoDownload(nomeArquivo, contentType, anexoId);
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = nome;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
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

export async function comprasExcluirItemConsumo(id) {
  const { data } = await api.delete(`/api/compras/itens-consumo/${id}`);
  return data;
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

export async function comprasEconomia({
  competencia,
  data_inicio,
  data_fim,
  instituicao_id,
  escopo,
} = {}) {
  const params = {};
  if (competencia) params.competencia = competencia;
  if (data_inicio) params.data_inicio = data_inicio;
  if (data_fim) params.data_fim = data_fim;
  if (instituicao_id) params.instituicao_id = instituicao_id;
  if (escopo) params.escopo = escopo;
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
