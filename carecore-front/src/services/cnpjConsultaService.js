import { mapearConsultaCnpj } from '../utils/nfpConsultaCnpjUtils';

const FONTES = [
  (cnpj) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
  (cnpj) => `https://minhareceita.org/${cnpj}`,
];

async function buscarJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CareCorePlus/1.0',
    },
  });
  if (response.status === 404) return { vazio: true };
  if (!response.ok) return { falhou: true };
  return { dados: await response.json() };
}

export async function consultarCnpjReceita(cnpj) {
  const cnpjLimpo = String(cnpj || '').replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) return null;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 8000);

  try {
    let ultimaFalha = false;
    for (const montarUrl of FONTES) {
      const resultado = await buscarJson(montarUrl(cnpjLimpo), controlador.signal);
      if (resultado.vazio) return null;
      if (resultado.dados) return mapearConsultaCnpj(resultado.dados);
      ultimaFalha = Boolean(resultado.falhou);
    }
    if (ultimaFalha) {
      throw new Error('Não foi possível consultar o CNPJ agora.');
    }
    return null;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Não foi possível consultar o CNPJ agora.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
