// ============================================================
// SERVICE WORKER — TSA Presence PWA
// Cache-first strategy untuk offline support
// ============================================================

const CACHE_NAME = 'tsa-presence-v1';

// File-file yang di-cache saat install (App Shell)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './config.js',
  './assets/style.css',
  './assets/favicon.ico',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  './js/state.js',
  './js/utils.js',
  './js/services/supabase.js',
  './js/services/auth.js',
  './js/services/data.js',
  './js/components/navigation.js',
  './js/components/camera.js',
  './js/components/clock-geo.js',
  './js/pages/employee-portal.js',
  './js/pages/admin-dashboard.js',
  './js/pages/admin-employees.js',
  './js/pages/admin-offices.js',
  './js/pages/admin-settings.js',
  './js/pages/admin-export.js',
  './js/pages/admin-leave.js',
];

// ============================================================
// INSTALL — pre-cache app shell
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    }).catch((err) => {
      console.warn('[SW] Pre-cache failed (some files may not exist yet):', err);
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — Network-first untuk API, Cache-first untuk assets
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan cache request ke Supabase API atau CDN eksternal
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    event.request.method !== 'GET'
  ) {
    return; // Biarkan browser handle langsung (network only)
  }

  // Cache-first untuk file lokal (app shell)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cache response baru yang valid
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          // Fallback ke index.html saat offline (untuk navigasi)
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
