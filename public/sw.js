// Minimal service worker so staff can install the ERP as a mobile app (PWA).
// Only hashed static build assets are cached. Pages and data are always fetched
// from the network, so no student or financial data is ever stored by the worker.
const CACHE = 'erp-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => (res.ok && c.put(e.request, res.clone()), res))),
    ),
  );
});
