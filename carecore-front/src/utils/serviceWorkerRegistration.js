export function registrarServiceWorkerCareCore() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Não foi possível registrar o service worker do CareCore+.', error);
    });
  });
}
