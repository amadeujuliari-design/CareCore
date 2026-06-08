import { API_BASE_URL } from '../config/apiBase';
import { obterTokenLocal } from '../services/api';
import { criarHeadersAutenticados } from './requestIdUtils';

/**
 * Transforma um caminho salvo no banco (/uploads/... ou uploads/...) na rota autenticada GET /api/arquivos/...
 * URLs absolutas já http(s) são devolvidas como estão.
 */
export function urlArquivoBackend(caminhoOuUrl) {
  if (!caminhoOuUrl) {
    return '';
  }

  const bruto = String(caminhoOuUrl).trim();

  if (/^https?:\/\//i.test(bruto)) {
    try {
      const u = new URL(bruto);
      const idx = u.pathname.indexOf('/uploads/');

      if (idx !== -1) {
        const resto = u.pathname.slice(idx + '/uploads/'.length);

        return `${API_BASE_URL}/api/arquivos/${resto}`;
      }

      return bruto;
    } catch {
      return bruto;
    }
  }

  let p = bruto;

  if (p.startsWith('/uploads/')) {
    p = p.slice('/uploads/'.length);
  } else if (p.startsWith('uploads/')) {
    p = p.slice('uploads/'.length);
  } else if (p.startsWith('/')) {
    p = p.slice(1);
  }

  if (!p) {
    return '';
  }

  return `${API_BASE_URL}/api/arquivos/${p}`;
}

export async function baixarArquivoAutenticado(caminhoOuUrl, nomeSugerido) {
  const url = urlArquivoBackend(caminhoOuUrl);

  if (!url) {
    throw new Error('Caminho de arquivo inválido.');
  }

  const token = obterTokenLocal();
  const resposta = await fetch(url, {
    headers: criarHeadersAutenticados(token),
  });

  if (!resposta.ok) {
    throw new Error('Não foi possível baixar o arquivo.');
  }

  const blob = await resposta.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nomeSugerido || 'documento';
  link.click();
  URL.revokeObjectURL(link.href);
}
