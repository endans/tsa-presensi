const CACHE_NAME = 'tsa-presence-v1';

// File-file yang akan di-cache untuk offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './assets/style.css',
  './assets/logo.svg',
  './assets/logo-white.svg',
  './js/state.js',
  './js/utils.js',
  './js/services/supabase.js',
  './js/services/auth.js',
  './js/services/data.js',
  './js/components/navigation.js',
  './js/components/camera.js',
  './js/components/clock-geo.js',
  './js/pages/admin-dashboard.js',
  './js/pages/admin-employees.js',
  './js/pages/admin-export.js',
  './js/pages/admin-leave.js',
  './js/pages/admin-offices.js',
  './js/pages/admin-settings.js',
  './js/pages/employee-portal.js',
];

// =====================
// INSTALL — Cache semua static assets
// =====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// =====================
// ACTIVATE — Hapus cache lama
// =====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
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

// =====================
// FETCH — Strategi: Network First, fallback ke Cache
// =====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Lewati request ke Supabase & CDN eksternal (selalu butuh internet)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  // Untuk semua asset lokal: Network First → fallback Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Simpan response terbaru ke cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: ambil dari cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;

          // Jika halaman HTML tidak ditemukan, tampilkan index
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// =====================
// Notifikasi update tersedia (opsional)
// =====================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
