// Service worker for proportion only.
// Bump the number in VERSION to make phones drop the old cache right away.
const PREFIX = 'proportion-';
const VERSION = PREFIX + 'v6';

const ASSETS = [
  './',
  './index.html',
  './manifest-proportion.json',
  './proportion-180.png',
  './proportion-192.png',
  './proportion-512.png',
  './proportion-maskable-512.png'
];

// The theme fonts come from Google. They are saved the first time the app
// opens online, so the app keeps its look offline.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Only clears this tool's old caches, never the other tool's.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: use the saved copy if there is one; otherwise fetch it and save it.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((cached) => cached || fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => cached || Response.error()))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App files: open instantly from the cache (works offline), then quietly
  // fetch a fresh copy so the next open has any update you pushed.
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return network.then((res) => res || new Response('Offline and not cached yet.', { status: 503 }));
      })
    )
  );
});
