/** Cache em memória de blob URLs por rota autenticada de arquivo. */
const cache = new Map();
const LIMITE_CACHE_FOTOS = 120;

function revogarBlobUrl(blobUrl) {
  if (typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) return;

  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Alguns navegadores podem revogar automaticamente no descarte da página.
  }
}

export function obterFotoCache(urlAutorizada) {
  if (!urlAutorizada) return null;
  const blobUrl = cache.get(urlAutorizada) || null;

  if (blobUrl) {
    cache.delete(urlAutorizada);
    cache.set(urlAutorizada, blobUrl);
  }

  return blobUrl;
}

export function salvarFotoCache(urlAutorizada, blobUrl) {
  if (!urlAutorizada || !blobUrl) return;

  const anterior = cache.get(urlAutorizada);
  if (anterior && anterior !== blobUrl) {
    revogarBlobUrl(anterior);
  }

  cache.delete(urlAutorizada);
  cache.set(urlAutorizada, blobUrl);

  while (cache.size > LIMITE_CACHE_FOTOS) {
    const chaveMaisAntiga = cache.keys().next().value;
    if (!chaveMaisAntiga) break;

    const blobAntigo = cache.get(chaveMaisAntiga);
    cache.delete(chaveMaisAntiga);
    revogarBlobUrl(blobAntigo);
  }
}

export function limparFotoCache() {
  cache.forEach((blobUrl) => revogarBlobUrl(blobUrl));
  cache.clear();
}
