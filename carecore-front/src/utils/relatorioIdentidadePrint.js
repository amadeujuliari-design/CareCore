import logoCarecore from '../assets/logo.PNG';
import { API_ROOT } from '../config/apiBase';
import { obterTokenLocal } from '../services/api';
import { urlArquivoBackend } from './arquivosApi';
import { criarHeadersAutenticados, criarHeadersCareCore } from './requestIdUtils';

export async function buscarIdentidadeRelatorios() {
  const token = obterTokenLocal();

  if (!token) return null;

  try {
    const response = await fetch(`${API_ROOT}/organizacao/identidade-relatorios`, {
      headers: criarHeadersAutenticados(token),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

export async function urlImagemParaDataUrl(url) {
  if (!url) return '';

  let headers = criarHeadersCareCore();
  if (url.includes('/api/arquivos/')) {
    const token = obterTokenLocal();
    headers = criarHeadersAutenticados(token);
  }

  try {
    const resposta = await fetch(url, { headers });
    if (!resposta.ok) return '';

    const blob = await resposta.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export async function obterLogoRelatorioDataUrl(identidadeRelatorio = null) {
  if (!identidadeRelatorio?.relatorio_logo_url) {
    return '';
  }

  return await urlImagemParaDataUrl(
    urlArquivoBackend(identidadeRelatorio.relatorio_logo_url),
  );
}

export function obterLogoRelatorioSrc(logoRelatorioDataUrl = '') {
  return logoRelatorioDataUrl || logoCarecore;
}
