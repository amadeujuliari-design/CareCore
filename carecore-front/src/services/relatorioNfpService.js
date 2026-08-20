import api from './api';

export async function nfpRelatorioRateioConsolidado(params = {}) {
  const { data } = await api.get('/api/nfp/relatorios/rateio-consolidado', { params });
  return data;
}

export async function nfpRelatorioRateioDetalhado(params = {}) {
  const { data } = await api.get('/api/nfp/relatorios/rateio-detalhado', { params });
  return data;
}

export async function nfpExportarRateioDetalhado(params = {}) {
  const response = await api.get('/api/nfp/relatorios/rateio-detalhado/exportar', {
    params,
    responseType: 'blob',
    timeout: 600_000,
  });
  return response;
}

export async function nfpOrigensRateio(params = {}) {
  const { data } = await api.get('/api/nfp/relatorios/origens-rateio', { params });
  return data;
}

export async function nfpRelatorioCupons(params = {}) {
  const { data } = await api.get('/api/nfp/relatorios/cupons', { params });
  return data;
}
