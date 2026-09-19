// Abodid Sahoo — PWA Service Worker
const CACHE_VERSION = 'abodid-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Essential core assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/site.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Domains/Paths that MUST NEVER be cached (authentication, server functions, databases)
const BYPASS_PATTERNS = [
  /\/api\//i,
  /\/admin\//i,
  /\/_vercel\//i,
  /supabase\.co/i,
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /resend\.com/i,
  /openrouter\.ai/i
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset fetch failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('abodid-pwa-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-http/https (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Security bypass: Never cache APIs, admin, analytics, or external secure backends
  if (BYPASS_PATTERNS.some((pattern) => pattern.test(url.href) || pattern.test(url.pathname))) {
    return;
  }

  // 4. Skip partial content requests (video streaming, media ranges)
  if (request.headers.get('range')) {
    return;
  }

  // Strategy A: HTML Document Navigation -> Network First with Cache Fallback
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to cached root shell if available
          return caches.match('/');
        })
    );
    return;
  }

  // Strategy B: Static Build Assets (_astro, styles, scripts, fonts, icons) -> Stale While Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/styles/') ||
    url.pathname.startsWith('/scripts/') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    ['style', 'script', 'font', 'image'].includes(request.destination);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
              const responseToCache = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Strategy C: Default -> Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
