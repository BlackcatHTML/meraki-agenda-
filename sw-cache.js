/* ============================================================
   Cache do app (offline).
   Importado por sw.js e tambem por OneSignalSDKWorker.js —
   assim o mesmo cache vale com ou sem push configurado.
   ============================================================ */

var CACHE = 'meraki-v5';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/config.js',
  './js/store.js',
  './js/push.js',
  './js/app.js',
  './img/meraki-flor.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll falha inteiro se um item falhar; aqui cada um vai por conta.
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fontes e SDK ficam com o browser

  // Navegacao: rede primeiro, cai pro index em cache quando offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }

  function guardar(res) {
    if (res && res.status === 200 && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }

  // Icones nao mudam de conteudo sem mudar de nome: cache primeiro,
  // revalidando em segundo plano.
  if (/\/icons\//.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(guardar).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // Codigo do app (CSS, JS, manifest): rede primeiro. Assim um deploy novo
  // aparece ja na proxima abertura, e nao na seguinte. O cache continua
  // valendo quando estiver sem internet.
  e.respondWith(
    fetch(req).then(guardar).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || new Response('', { status: 504 });
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
