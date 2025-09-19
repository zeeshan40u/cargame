const CACHE_NAME = 'pixel-racer-cache-v1';

// List of all essential files and assets for your game
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/cargame192.png',
  '/cargame512.png',
  '/shieldcargame.mp3', 
  // IMPORTANT: Replace this with your actual background music file name
  '/bg-music.mp3' 
];

// --- INSTALLATION: Pre-caching Assets ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('[Service Worker] Failed to cache:', err);
      })
  );
  // Forces the new service worker to activate immediately
  self.skipWaiting();
});

// --- ACTIVATION: Cleanup Old Caches ---
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- FETCH: Cache-First Strategy ---
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }
        // Otherwise, fetch from the network
        return fetch(event.request);
      })
  );
});
