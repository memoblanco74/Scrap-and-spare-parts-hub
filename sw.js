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
  const TAG = 'scrap-hub-logs';
  const badge = new URL('badge.png', self.registration.scope).href;
  const icon = d.icon || 'https://auurmvfaqkxaxowxoqkl.supabase.co/storage/v1/object/public/images/laptop-screen.png?v=2';
  const line = (d.title || 'New log') + (d.body ? ' - ' + d.body : '');
  event.waitUntil(self.registration.getNotifications({ tag: TAG }).then((existing) => {
    let lines = [line];
    let count = 1;
    if (existing && existing.length) {
      const prev = existing[0].data || {};
      lines = [line].concat(prev.lines || []).slice(0, 6);
      count = (prev.count || 1) + 1;
      existing.forEach((n) => n.close());
    }
    const title = count > 1 ? 'Scrap Hub - ' + count + ' new logs' : (d.title || 'Scrap & Spare Parts Hub');
    const body = count > 1 ? lines.join('\n') : (d.body || '');
    return self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: TAG,
      renotify: true,
      data: { url: d.url || './', lines, count }
    });
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
