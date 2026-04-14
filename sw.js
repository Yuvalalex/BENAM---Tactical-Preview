// ═══════════════════════════════════════════════════════════
// BENAM Service Worker v9.1 — Offline-First, Production-Grade
// ═══════════════════════════════════════════════════════════
// __BUILD_TIMESTAMP__ is replaced by Vite plugin at build time
const CACHE_NAME = 'benam-v9.1-' + ('__BUILD_TIMESTAMP__'.startsWith('__') ? 'dev' : '__BUILD_TIMESTAMP__');

// Core assets to precache (legacy files served alongside Vite output)
const ASSETS = [
  './',
  './index.html',
  './js/app.js',
  './js/enhancements.js',
  './js/vendor/qrcode.min.js',
  './js/vendor/jsQR.min.js',
  './manifest.json',
  './icons/png/icon-192.png',
  './icons/png/icon-512.png'
];

// Install — precache all critical assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching assets');
        return Promise.allSettled(
          ASSETS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches, notify clients about update
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Removing old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
          });
        });
      })
  );
});

// Fetch — smart routing based on asset type
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation requests — network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Vite hashed assets (assets/*.js, assets/*.css) — cache-first (immutable)
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets — cache-first with network fallback + background revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
