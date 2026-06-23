import { useCallback, useEffect, useRef, useState } from 'react';

import { CARECORE_VERSAO } from '../config/versao.js';
import {
  INTERVALO_CHECAGEM_VERSAO_MS,
  buscarVersaoPublicada,
  versaoRemotaDiferente,
} from '../utils/atualizacaoAppUtils.js';
import {
  aplicarAtualizacaoServiceWorker,
  escutarAtualizacaoDisponivel,
  escutarServiceWorkerControlador,
} from '../utils/serviceWorkerRegistration.js';

export function useAtualizacaoApp() {
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false);
  const [versaoRemota, setVersaoRemota] = useState(null);
  const recarregandoRef = useRef(false);

  const marcarAtualizacao = useCallback((remota) => {
    if (remota) {
      setVersaoRemota(remota);
    }
    setAtualizacaoDisponivel(true);
  }, []);

  const checarVersaoPublicada = useCallback(async () => {
    if (!import.meta.env.PROD) {
      return;
    }

    try {
      const remota = await buscarVersaoPublicada();
      if (versaoRemotaDiferente(CARECORE_VERSAO, remota)) {
        marcarAtualizacao(remota);
      }
    } catch {
      // Falha de rede ou arquivo ausente: ignora e tenta depois.
    }
  }, [marcarAtualizacao]);

  const recarregarApp = useCallback(async () => {
    if (recarregandoRef.current) {
      return;
    }

    recarregandoRef.current = true;
    await aplicarAtualizacaoServiceWorker();
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return undefined;
    }

    checarVersaoPublicada();

    const intervalo = window.setInterval(checarVersaoPublicada, INTERVALO_CHECAGEM_VERSAO_MS);
    const aoVisivel = () => {
      if (document.visibilityState === 'visible') {
        checarVersaoPublicada();
      }
    };

    document.addEventListener('visibilitychange', aoVisivel);
    const removerEventoSw = escutarAtualizacaoDisponivel(() => {
      marcarAtualizacao();
    });
    const removerController = escutarServiceWorkerControlador(() => {
      if (recarregandoRef.current) {
        window.location.reload();
      }
    });

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVisivel);
      removerEventoSw();
      removerController();
    };
  }, [checarVersaoPublicada, marcarAtualizacao]);

  return {
    atualizacaoDisponivel,
    versaoAtual: CARECORE_VERSAO,
    versaoRemota,
    recarregarApp,
  };
}
