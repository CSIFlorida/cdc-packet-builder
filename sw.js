/* Offline cache. Bump CACHE when you publish a new version so users get the update. */
const CACHE = 'cdc-packet-v3.4.0';
const FILES = ['./', './index.html', './vendor.html', './employee.html', './application.html', './consumers.html', './consumers.js', './grid.js', './docs.js', './readers.js', './lib/pdf.min.js', './lib/pdf.worker.min.js', './purchasing.html', './purchasing.js', './fill-purchasing.js', './lib/exceljs.min.js', './forms/tpl-purchasing.js', './app.css', './version.js', './core.js',
  './vendor.js', './employee.js', './application.js', './fill.js', './fill-employee.js', './fill-application.js', './lib/pdf-lib.min.js',
  './forms/tpl-common.js', './forms/tpl-vendor.js', './forms/tpl-employee.js', './forms/tpl-application.js',
  './manifest.webmanifest', './browserconfig.xml', './favicon.ico', './icons/icon-16.png', './icons/icon-32.png',
  './icons/icon-96.png', './icons/icon-144.png', './icons/icon-152.png', './icons/icon-167.png', './icons/icon-192.png', './icons/icon-256.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
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
