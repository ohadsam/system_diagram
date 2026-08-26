// Service worker for offline/installable support (see io/serviceWorker.js
// for registration). This app is 100% static with no build step and no
// generated asset manifest, so a hand-maintained precache list would go
// stale the moment a new .js/.css file is added — instead this caches
// opportunistically ("stale-while-revalidate"): the first time any
// same-origin GET request is made, its response is cached; every request
// after that serves the cached copy immediately (fast, and works offline)
// while a fresh copy is fetched in the background to update the cache for
// next time. A visitor who has opened the app once while online can keep
// using it offline afterward, without this file needing to know the full
// file list.
const CACHE_NAME = 'sdb-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Cross-origin requests (an AI provider's site opened in a new tab, a
  // Google Fonts request if one is ever added, ...) are left alone —
  // this app only needs to cache its own same-origin static files.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached); // offline and nothing cached yet — the caller's own fetch() rejects, same as without a service worker
      return cached || networkFetch;
    })
  );
});
