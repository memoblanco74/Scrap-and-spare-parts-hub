// Service Worker بسيط لدعم تثبيت التطبيق (PWA) — بدون كاش قوي، بس عشان معايير الـ installability
const CACHE_NAME = 'scrap-hub-cache-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: يحاول ياخد أحدث نسخة من النت، ولو النت مقطوع يرجع للكاش (لو موجود)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone).catch(() => {}));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
