const CACHE_NAME = 'xr-books-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/index.js',
  '/manifest.webmanifest',
  '/assets/screenshot.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Simple runtime caching: cache-first for shell/static, network-first for book files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For requests to /books/, prefer network but fallback to cache
  if (url.pathname.startsWith('/books/')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        // store a copy
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
