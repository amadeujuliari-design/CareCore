const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('cv') || 'legacy';
const CACHE_SHELL = `carecore-shell-${APP_VERSION}`;
const CACHE_ASSETS = `carecore-assets-${APP_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/carecore-icon-192.png',
  '/carecore-icon-512.png',
  '/carecore-icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_SHELL && cacheName !== CACHE_ASSETS)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function cachearResposta(cacheName, request, response) {
  if (!response.ok) {
    return;
  }

  const responseClone = response.clone();
  caches.open(cacheName).then((cache) => cache.put(request, responseClone));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.pathname === '/version.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cachearResposta(CACHE_SHELL, '/', response);
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cachearResposta(CACHE_ASSETS, request, response);
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cacheable = response.ok && ['style', 'script', 'image', 'font'].includes(request.destination);
        if (cacheable) {
          cachearResposta(CACHE_ASSETS, request, response);
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
