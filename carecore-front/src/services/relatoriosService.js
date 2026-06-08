import api from './api';

export const LIMITE_AMOSTRA_OCORRENCIAS_RELATORIOS = 200;

function obterStatusOcorrenciaApi(filtros) {
  if (filtros.somentePendencias || filtros.statusOcorrencia === 'Pendentes') {
    return 'Pendente';
  }

  if (filtros.statusOcorrencia === 'Resolvidas') {
    return 'Resolvido';
  }

  return 'Todos';
}

export async function carregarDadosRelatorios({ aba, filtros, carregarIdentidade }) {
  const carregarHistoricoRotina = ['rotina', 'auditoria'].includes(aba);
  const carregarResumoEvolucao = aba === 'evolucao';
  const statusOcorrenciaApi = obterStatusOcorrenciaApi(filtros);

  const [
    conviventes,
    quartos,
    ocorrencias,
    tecnicos,
    rotina,
    historicoRotina,
    resumoRotinaEvolucao,
    avisos,
    resumoAvisos,
    identidade,
  ] = await Promise.all([
    api.get('/api/conviventes'),
    api.get('/api/quartos'),
    api.get('/api/ocorrencias', {
      params: {
        limit: LIMITE_AMOSTRA_OCORRENCIAS_RELATORIOS,
        offset: 0,
        prioridade: filtros.prioridadeOcorrencia,
        status: statusOcorrenciaApi,
        tecnico_id: filtros.tecnicoId || undefined,
        status_convivente: filtros.statusConvivente,
        data_inicio: filtros.dataInicio || undefined,
        data_fim: filtros.dataFim || undefined,
        busca: filtros.busca.trim() || undefined,
      },
    }),
    api.get('/api/tecnicos'),
    carregarHistoricoRotina
      ? api.get('/api/rotina/dashboard-operacional').catch(() => ({ data: null }))
      : Promise.resolve(null),
    carregarHistoricoRotina
      ? api.get('/api/rotina/historico', {
        params: {
          data_inicio: filtros.dataInicio || undefined,
          data_fim: filtros.dataFim || undefined,
          limite: 5000,
        },
      }).catch(() => ({ data: [] }))
      : Promise.resolve(null),
    carregarResumoEvolucao
      ? api.get('/api/rotina/historico/resumo-evolucao', {
        params: {
          data_inicio: filtros.dataInicio || undefined,
          data_fim: filtros.dataFim || undefined,
          tecnico_id: filtros.tecnicoId || undefined,
          status_convivente: filtros.statusConvivente !== 'Todos' ? filtros.statusConvivente : undefined,
        },
      }).catch(() => ({ data: [] }))
      : Promise.resolve(null),
    Promise.resolve(null),
    Promise.resolve(null),
    carregarIdentidade
      ? api.get('/api/organizacao/identidade-relatorios').catch(() => ({ data: null }))
      : Promise.resolve(null),
  ]);

  return {
    conviventes: conviventes.data || [],
    quartos: quartos.data || [],
    ocorrencias: ocorrencias.data,
    tecnicos: tecnicos.data || [],
    rotina: rotina?.data || null,
    historicoRotina: historicoRotina?.data || [],
    resumoRotinaEvolucao: resumoRotinaEvolucao?.data || [],
    avisos,
    resumoAvisos,
    identidade: identidade?.data || null,
  };
}

export async function salvarIdentidadeRelatorios(payload) {
  const response = await api.put('/api/organizacao/identidade-relatorios', payload);
  return response.data;
}

export async function enviarLogoIdentidadeRelatorios(formData) {
  const response = await api.post(
    '/api/organizacao/identidade-relatorios/logo',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function removerLogoIdentidadeRelatorios() {
  const response = await api.delete('/api/organizacao/identidade-relatorios/logo');
  return response.data;
}
