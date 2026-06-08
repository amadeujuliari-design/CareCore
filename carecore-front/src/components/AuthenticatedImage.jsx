import { useEffect, useRef, useState } from 'react';

import { urlArquivoBackend } from '../utils/arquivosApi';
import { obterFotoCache, salvarFotoCache } from '../utils/fotoCache';
import { obterTokenLocal } from '../services/api';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';

/**
 * <img> com Bearer — necessário porque /uploads não é mais público.
 * lazy=true carrega só quando o elemento entra na viewport (listas grandes).
 */
export default function AuthenticatedImage({
  caminhoOuUrl,
  alt = '',
  className = '',
  lazy = false,
  ...rest
}) {
  const containerRef = useRef(null);
  const [visivel, setVisivel] = useState(!lazy);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!lazy) return undefined;

    const elemento = containerRef.current;
    if (!elemento) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' }
    );

    observer.observe(elemento);

    return () => observer.disconnect();
  }, [lazy, caminhoOuUrl]);

  useEffect(() => {
    if (!visivel) return undefined;

    let cancelado = false;
    const controller = new AbortController();
    const autorizada = urlArquivoBackend(caminhoOuUrl);

    if (!autorizada) {
      setBlobUrl(null);
      return undefined;
    }

    const emCache = obterFotoCache(autorizada);
    if (emCache) {
      setBlobUrl(emCache);
      return undefined;
    }

    setBlobUrl(null);

    async function carregar() {
      const precisaBearer = autorizada.includes('/api/arquivos/');

      if (!precisaBearer) {
        if (!cancelado) {
          setBlobUrl(autorizada);
        }
        return;
      }

      const token = obterTokenLocal();

      try {
        const resposta = await fetch(autorizada, {
          headers: criarHeadersAutenticados(token),
          signal: controller.signal,
        });

        if (!resposta.ok || cancelado) {
          return;
        }

        const blob = await resposta.blob();
        const objetoUrl = URL.createObjectURL(blob);
        salvarFotoCache(autorizada, objetoUrl);

        if (!cancelado) {
          setBlobUrl(objetoUrl);
        }
      } catch (error) {
        if (error?.name === 'AbortError' || cancelado) {
          return;
        }

        if (!cancelado) {
          setBlobUrl(null);
        }
      }
    }

    carregar();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [caminhoOuUrl, visivel]);

  if (lazy && !visivel) {
    return <span ref={containerRef} className={className} aria-hidden="true" />;
  }

  if (!blobUrl) {
    return lazy ? <span ref={containerRef} className={className} aria-hidden="true" /> : null;
  }

  return (
    <img
      {...rest}
      ref={containerRef}
      src={blobUrl}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
