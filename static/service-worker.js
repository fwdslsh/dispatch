// // Service Worker for Dispatch PWA
// const CACHE_VERSION = new Date().getTime(); //HACK: effectively disable caching for now
// const CACHE_NAME = `dispatch-v${CACHE_VERSION}`;
// const RUNTIME_CACHE = `dispatch-runtime-v${CACHE_VERSION}`;

// // Core files to cache during installation
// const STATIC_ASSETS = [
//   '/',
//   '/workspace',
//   '/offline.html',
//   '/favicon.png',
//   '/icon-192.png',
//   '/icon-512.png',
//   '/manifest.json',
//   '/fonts/exo-2/7cHmv4okm5zmbtYoK-4.woff2',
//   '/fonts/share-tech-mono/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2',
//   '/fonts/protest-revolution/ProtestRevolution-Regular-latin.woff2'
// ];

// // Install event - cache core assets
// self.addEventListener('install', (event) => {
//   event.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => {
//       console.log('[Service Worker] Caching static assets');
//       return cache.addAll(STATIC_ASSETS);
//     })
//   );
//   // Force the waiting service worker to become the active service worker
//   self.skipWaiting();
// });

// // Activate event - clean up old caches
// self.addEventListener('activate', (event) => {
//   event.waitUntil(
//     caches.keys().then((cacheNames) => {
//       return Promise.all(
//         cacheNames
//           .filter((cacheName) => {
//             return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
//           })
//           .map((cacheName) => {
//             console.log('[Service Worker] Removing old cache:', cacheName);
//             return caches.delete(cacheName);
//           })
//       );
//     })
//   );
//   // Take control of all pages immediately
//   self.clients.claim();
// });

// // Fetch event - serve from cache when possible
// self.addEventListener('fetch', (event) => {
//   const { request } = event;
  
//   // Skip WebSocket requests and API calls
//   if (request.url.includes('/socket.io/') || 
//       request.url.includes('/api/') ||
//       request.url.startsWith('ws://') || 
//       request.url.startsWith('wss://')) {
//     return;
//   }

//   // Network-first strategy for HTML pages
//   if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
//     event.respondWith(
//       fetch(request)
//         .then((response) => {
//           // Cache successful responses
//           if (response.ok) {
//             const responseToCache = response.clone();
//             caches.open(RUNTIME_CACHE).then((cache) => {
//               cache.put(request, responseToCache);
//             });
//           }
//           return response;
//         })
//         .catch(() => {
//           // Fall back to cache if network fails
//           return caches.match(request).then((response) => {
//             return response || caches.match('/');
//           });
//         })
//     );
//     return;
//   }

//   // Cache-first strategy for static assets
//   event.respondWith(
//     caches.match(request).then((response) => {
//       if (response) {
//         return response;
//       }

//       return fetch(request).then((response) => {
//         // Don't cache non-successful responses
//         if (!response || response.status !== 200 || response.type !== 'basic') {
//           return response;
//         }

//         // Cache the fetched response for future use
//         const responseToCache = response.clone();
//         caches.open(RUNTIME_CACHE).then((cache) => {
//           cache.put(request, responseToCache);
//         });

//         return response;
//       });
//     })
//   );
// });

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});