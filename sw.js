const CACHE_NAME = 'webtuner-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/asciiTuner.js',
  './js/autoDetectState.js',
  './js/gauge.js',
  './js/noteShapes.js',
  './js/noteUtils.js',
  './js/pitchDetector.js',
  './js/referenceTone.js',
  './js/tunings.js',
  './js/ui.js',
  './js/wakeLock.js',
  './manifest.json',
];

// Pre-cache all static assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      await self.skipWaiting();
    })()
  );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('webtuner-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch strategy: network-first for navigations, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation requests: network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
        }
      })()
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Same-origin assets: cache first, fall back to network (update cache)
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
  } else {
    // Cross-origin (Google Fonts, esm.sh): cache first, network fallback
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
  }
});
