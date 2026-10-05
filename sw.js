// Service worker: red primero (así una versión nueva se ve al momento) y caché para funcionar sin conexión.
// 904e244ba4 lo sustituye bin/publicar.sh por una huella del contenido: cada publicación cambia este archivo,
// el navegador detecta el service worker nuevo y la app muestra "Hay una versión nueva".
const BUILD = '904e244ba4';
const CACHE = 'mis-cuentas-' + BUILD;
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './calc.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('mis-cuentas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      // no-cache: revalida con el servidor aunque el navegador tenga una copia reciente.
      const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
      if (res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    } catch (err) {
      const guardada = await caches.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      if (req.mode === 'navigate') {
        const inicio = await caches.match('./index.html');
        if (inicio) return inicio;
      }
      throw err;
    }
  })());
});
