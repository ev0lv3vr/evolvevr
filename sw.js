/* Japan 2026 — offline cache. Page: network-first (updates win); libraries & fonts:
   cache-first. Map tiles and the weather API stay network-only. */
var CACHE = 'jp26-v1';
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cors mode so cached copies keep passing the page's SRI integrity checks
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(new Request(u, { mode: u.indexOf('http') === 0 ? 'cors' : 'same-origin' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // never intercept map tiles or live weather — they're network-only by design
  if (url.hostname.indexOf('cartocdn.com') > -1 || url.hostname.indexOf('open-meteo.com') > -1) return;

  if (e.request.mode === 'navigate') {
    // page: network-first so redeployed updates arrive; cached copy when offline
    e.respondWith(
      fetch(e.request).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // everything else (leaflet, fonts, icons): cache-first, fill cache on the way through
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (r) {
        if (r && r.status === 200 && (r.type === 'basic' || r.type === 'cors')) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return r;
      });
    })
  );
});
