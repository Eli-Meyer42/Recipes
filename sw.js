// Recipes service worker.
// Network-first for the page itself (so a new deploy always shows up), cache-first
// for icons, and never touch cross-origin requests (Firebase, CDNs, Google Fonts).
const CACHE = 'recipes-v1';
const ICONS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ICONS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let Firebase/CDN/fonts go straight to network.
  if (url.origin !== self.location.origin) return;

  // Icons: cache-first.
  if (url.pathname.indexOf('/icons/') !== -1) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // Navigations / the page: network-first, fall back to cache when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else same-origin: try network, fall back to cache.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
