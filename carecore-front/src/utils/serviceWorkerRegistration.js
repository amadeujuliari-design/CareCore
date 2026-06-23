import { CARECORE_VERSAO } from '../config/versao.js';

const EVENTO_ATUALIZACAO = 'carecore:atualizacao-disponivel';

export function registrarServiceWorkerCareCore() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `/sw.js?cv=${encodeURIComponent(CARECORE_VERSAO)}`;

    navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting) {
          notificarAtualizacaoDisponivel('service-worker');
        }

        registration.addEventListener('updatefound', () => {
          const novoWorker = registration.installing;
          if (!novoWorker) {
            return;
          }

          novoWorker.addEventListener('statechange', () => {
            if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notificarAtualizacaoDisponivel('service-worker');
            }
          });
        });

        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.warn('Não foi possível registrar o service worker do CareCore+.', error);
      });
  });
}

export function notificarAtualizacaoDisponivel(origem = 'desconhecida') {
  window.dispatchEvent(new CustomEvent(EVENTO_ATUALIZACAO, { detail: { origem } }));
}

export function escutarAtualizacaoDisponivel(callback) {
  const handler = (event) => callback(event.detail || {});
  window.addEventListener(EVENTO_ATUALIZACAO, handler);
  return () => window.removeEventListener(EVENTO_ATUALIZACAO, handler);
}

export async function aplicarAtualizacaoServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.waiting) {
    return false;
  }

  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export function escutarServiceWorkerControlador(callback) {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  navigator.serviceWorker.addEventListener('controllerchange', callback);
  return () => navigator.serviceWorker.removeEventListener('controllerchange', callback);
}
