import api from './api';

export async function obterResumoChat() {
  const response = await api.get('/api/chat/resumo');

  return {
    total_nao_lidas: Number(response.data?.total_nao_lidas || 0),
    total_conversas: Number(response.data?.total_conversas || 0),
  };
}

export async function listarUsuariosChat(busca = '') {
  const response = await api.get('/api/chat/usuarios', {
    params: {
      busca: busca || undefined,
      limite: 30,
    },
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function listarConversasChat() {
  const response = await api.get('/api/chat/conversas', {
    params: {
      limite: 20,
      offset: 0,
    },
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function criarConversaChat(participantesIds, titulo = '') {
  const response = await api.post('/api/chat/conversas', {
    participantes_ids: participantesIds,
    titulo: titulo || undefined,
  });

  return response.data;
}

export async function listarMensagensChat(conversaId, opcoes = {}) {
  const limite = Number(opcoes.limite || 30);
  const offset = Number(opcoes.offset || 0);

  const response = await api.get(`/api/chat/conversas/${conversaId}/mensagens`, {
    params: {
      limite,
      offset,
    },
  });

  return {
    items: Array.isArray(response.data?.items) ? response.data.items : [],
    total: Number(response.data?.total || 0),
    limit: Number(response.data?.limit || limite),
    offset: Number(response.data?.offset || offset),
    has_more: Boolean(response.data?.has_more),
  };
}

export async function enviarMensagemChat(conversaId, conteudo) {
  const response = await api.post(`/api/chat/conversas/${conversaId}/mensagens`, {
    conteudo,
  });

  return response.data;
}
