// Service Worker — GoodDoctor's Shop (PWA & Offline Resilience)
const CACHE_NAME = 'gooddoctor-cache-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/logo.webp',
  '/no-image.svg'
];

// Installation : mise en cache des ressources critiques locales
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
});

// Activation : nettoyage immédiat des anciens caches (v1, etc.)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes — UNIQUEMENT même origine (évite tout blocage CSP connect-src sur les images Supabase/Unsplash)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ne jamais intercepter les requêtes cross-origin (Supabase Storage, Unsplash, Google Fonts, OpenStreetMap...) :
  // le navigateur les charge directement via img-src / font-src / style-src avec leur cache HTTP natif.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Ne pas intercepter les appels API dynamiques (/api/products a déjà son cache localStorage déchiffré)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Fichiers statiques internes (JS, CSS, images locales) : Network-First pour HTML, Cache-First pour assets hashés
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        })
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});
