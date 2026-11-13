// ListX Service Worker - keeps the app working offline
const CACHE_NAME = 'listx-v23';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './imgs/icon-192.png',
  './imgs/icon-512.png'
];

// Install: cache everything the app needs. Files are fetched with
// cache:'reload' so a fresh SW always pulls the newest assets from the
// network instead of a stale HTTP cache.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((asset) =>
          fetch(new Request(asset, { cache: 'reload' })).then((response) => {
            if (!response.ok) {
              throw new Error('Failed to cache asset: ' + asset);
            }
            return cache.put(asset, response);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache first, fall back to network (and update cache)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
