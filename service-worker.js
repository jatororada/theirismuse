// ══════════════════════════════════════════════════════════════════
// SERVICE WORKER — theirismuse PWA
// ══════════════════════════════════════════════════════════════════
// Cachea la app para carga rápida y funcionamiento offline.
// Estrategia: network-first para el HTML (siempre la versión más nueva
// si hay conexión), cache-first para recursos estáticos (fuentes).

const CACHE_NAME = 'theirismuse-v1';
const APP_SHELL = [
  './',
  './index.html',
  './theirismuse.html',
];

// Instalación: cachear el app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Intentar cachear el shell; no fallar si algún recurso no existe
      return Promise.allSettled(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function() { return null; });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activación: limpiar caches viejos
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: estrategia según tipo de recurso
self.addEventListener('fetch', function(event) {
  var req = event.request;

  // Solo manejar peticiones GET
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // No interferir con Supabase ni APIs externas (siempre red)
  if (url.hostname.indexOf('supabase') !== -1 ||
      url.pathname.indexOf('/rest/') !== -1 ||
      url.pathname.indexOf('/auth/') !== -1) {
    return; // dejar pasar a la red normalmente
  }

  // Documentos HTML: network-first (versión más nueva si hay conexión)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req).then(function(res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('./') || caches.match('./theirismuse.html');
        });
      })
    );
    return;
  }

  // Fuentes de Google y otros estáticos: cache-first
  if (url.hostname.indexOf('fonts.googleapis.com') !== -1 ||
      url.hostname.indexOf('fonts.gstatic.com') !== -1 ||
      url.hostname.indexOf('cdnjs.cloudflare.com') !== -1) {
    event.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
          return res;
        });
      })
    );
    return;
  }

  // Resto: intentar red, fallback a cache
  event.respondWith(
    fetch(req).catch(function() { return caches.match(req); })
  );
});
