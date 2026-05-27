import { useEffect, useState } from 'react';

import { urlArquivoBackend } from '../utils/arquivosApi';
import { obterTokenLocal } from '../services/api';

/**
 * <img> com Bearer — necessário porque /uploads não é mais público.
 */
export default function AuthenticatedImage({
  caminhoOuUrl,
  alt = '',
  className = '',
  ...rest
}) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    let objetoUrlParaRevogar;
    let cancelado = false;

    async function carregar() {
      setBlobUrl(null);

      const autorizada = urlArquivoBackend(caminhoOuUrl);

      if (!autorizada) {
        return;
      }

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
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!resposta.ok || cancelado) {
          return;
        }

        const blob = await resposta.blob();
        objetoUrlParaRevogar = URL.createObjectURL(blob);

        if (!cancelado) {
          setBlobUrl(objetoUrlParaRevogar);
        }
      } catch {
        if (!cancelado) {
          setBlobUrl(null);
        }
      }
    }

    carregar();

    return () => {
      cancelado = true;

      if (objetoUrlParaRevogar) {
        URL.revokeObjectURL(objetoUrlParaRevogar);
      }
    };
  }, [caminhoOuUrl]);

  if (!blobUrl) {
    return null;
  }

  return (
    <img {...rest} src={blobUrl} alt={alt} className={className} />
  );
}
