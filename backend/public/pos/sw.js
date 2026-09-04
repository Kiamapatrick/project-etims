// Service Worker for eTIMS POS - PWA

const CACHE_NAME = 'etims-pos-v1';
const STATIC_ASSETS = [
  '/pos/pos.html',
  '/pos/pos.css',
  '/pos/pos.js',
  '/pos/manifest.json',
  '/style.css',
];

const CACHE_STRATEGIES = {
  // Cache First - for static assets
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      return new Response('Offline', { status: 503 });
    }
  },
  
  // Network First - for config API
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  
  // Network Only - for POST requests (sales)
  networkOnly: async (request) => {
    try {
      return await fetch(request);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Offline - sale will be queued' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) return;
  
  // API routes
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method === 'GET' && url.pathname.includes('/pos/config')) {
      event.respondWith(CACHE_STRATEGIES.networkFirst(event.request));
      return;
    }
    
    if (event.request.method === 'POST') {
      event.respondWith(CACHE_STRATEGIES.networkOnly(event.request));
      return;
    }
    
    event.respondWith(CACHE_STRATEGIES.networkFirst(event.request));
    return;
  }
  
  // Static assets
  if (
    event.request.method === 'GET' &&
    (url.pathname.endsWith('.html') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.json') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.jpg') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.ico'))
  ) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(event.request));
    return;
  }
  
  // Default: Network First
  event.respondWith(CACHE_STRATEGIES.networkFirst(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});