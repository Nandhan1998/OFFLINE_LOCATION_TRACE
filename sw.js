const CACHE_NAME = 'backtrail-v3';
const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.error('Backtrail SW install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Any navigation (page load/refresh) always falls back to the cached app shell
  // so a refresh while offline still opens the app instead of the browser's error page.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, res.clone());
          return res;
        });
      }).catch(() => cached);
    })
  );
});

// Lets the page ask "are you ready?" and get a real answer back.
self.addEventListener('message', event => {
  if (event.data === 'CHECK_READY') {
    caches.open(CACHE_NAME).then(cache =>
      cache.match('./index.html').then(match => {
        const reply = { type: 'READY_STATUS', ready: !!match };
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(reply);
        } else if (event.source) {
          event.source.postMessage(reply);
        }
      })
    );
  }
});
