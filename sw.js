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

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Scrap & Spare Parts Hub';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: d.icon || 'https://auurmvfaqkxaxowxoqkl.supabase.co/storage/v1/object/public/images/laptop-screen.png?v=2',
    badge: d.icon || 'https://auurmvfaqkxaxowxoqkl.supabase.co/storage/v1/object/public/images/laptop-screen.png?v=2',
    tag: d.tag || undefined,
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(target);
  }));
});
