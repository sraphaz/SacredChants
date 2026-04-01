/**
 * Service worker: prefer network; when offline, serve cached GET responses (filled by save-offline flow).
 * Cache name must match public/scripts/offline/constants.js (OFFLINE_CACHE_NAME).
 */
const ACTIVE_OFFLINE_CACHE = 'sc-offline-v10';
const OFFLINE_CACHE_PATTERN = /^sc-offline-v\d+$/;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(pruneStaleOfflineCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirstWithCacheFallback(event.request));
});

function pruneStaleOfflineCaches() {
  return caches.keys().then((keys) => {
    const removals = keys
      .filter((name) => OFFLINE_CACHE_PATTERN.test(name) && name !== ACTIVE_OFFLINE_CACHE)
      .map((name) => caches.delete(name));
    return Promise.all(removals);
  });
}

function networkFirstWithCacheFallback(request) {
  return fetch(request).catch(() => cacheFallback(request));
}

function cacheFallback(request) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      new Response('Offline', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
  );
}
