/* Offline cache. Bump CACHE when you publish a new version so users get the update. */
const CACHE = 'cdc-packet-v2.0.0';
const FILES = ['./', './index.html', './vendor.html', './employee.html', './app.css', './version.js', './core.js', './vendor.js', './employee.js',
  './fill.js', './fill-employee.js', './lib/pdf-lib.min.js', './forms/templates.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network first, so users always get the latest version; fall back to the saved copy when offline
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
