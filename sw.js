// sw.js - This file runs in the background as your Service Worker

const CACHE_NAME = 'allplay-cache-v1'; // Increment this version number when you change cached assets
const ASSETS_TO_CACHE = [
  '/', // Caches the index.html
  '/index.html',
  '/style.css', // Assuming your CSS is in style.css, adjust if path is different
  '/script.js', // Assuming your main JS is in script.js, adjust if path is different
  '/allplay-icon.png', // Your app icon
  '/manifest.json', // Your web app manifest
  // Add other critical static assets here (e.g., specific images, fonts)
  // Note: YouTube iframe API script is external and dynamically loaded, usually not cached directly
];

// --- Install Event ---
// This event is fired when the Service Worker is first installed.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching essential app shell assets');
        return cache.addAll(ASSETS_TO_CACHE); // Add all defined assets to the cache
      })
      .catch(error => {
        console.error('[Service Worker] Caching failed:', error);
      })
  );
});

// --- Activate Event ---
// This event is fired when the Service Worker becomes active.
// It's often used to clean up old caches.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) { // Delete old caches
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- Fetch Event ---
// This is the core of the Service Worker. It intercepts all network requests.
self.addEventListener('fetch', (event) => {
  // console.log('[Service Worker] Fetching:', event.request.url);

  // Strategy 1: Cache-first for known assets (app shell)
  // Tries to serve from cache first, then falls back to network.
  if (ASSETS_TO_CACHE.includes(event.request.url) || ASSETS_TO_CACHE.includes(event.request.url.replace(self.location.origin, ''))) {
      event.respondWith(
          caches.match(event.request).then((response) => {
              return response || fetch(event.request).then((networkResponse) => {
                  return caches.open(CACHE_NAME).then((cache) => {
                      cache.put(event.request, networkResponse.clone()); // Cache the new response
                      return networkResponse;
                  });
              });
          })
      );
      return; // Stop further processing for these assets
  }

  // Strategy 2: Network-first with cache fallback for dynamic content (YouTube API calls, thumbnails)
  // This is good for content that changes frequently.
  // It tries the network first, caches successful responses, and falls back to cache if offline.
  if (event.request.url.includes('googleapis.com/youtube') || event.request.url.includes('ytimg.com')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // IMPORTANT: Clone the response. A response is a stream and can only be consumed once.
          // We're consuming it once to return it to the browser, and once to cache it.
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        })
        .catch(() => {
          // Network failed, try to get it from the cache
          console.log('[Service Worker] Network failed, serving from cache:', event.request.url);
          return caches.match(event.request);
        })
    );
    return; // Stop further processing for these requests
  }

  // Default strategy: Just fetch from network for everything else
  event.respondWith(fetch(event.request));
});

// --- Message Event (Optional) ---
// For communicating between your app and the Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Force the new Service Worker to activate immediately
  }
});