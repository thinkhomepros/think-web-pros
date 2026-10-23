/* Offline support for the register and kitchen screen. The pages and their files come from the cache when the
   network is down (and refresh in the background when it is up). API calls always go to the network; the register
   keeps its own queue of sales for when they fail. Registered with scope /pos and /kitchen only, so the studio and
   the public site are never served from here. */
const CACHE = 'twp-pos-v1';
const FILES = ['/pos', '/kitchen', '/js/pos.js', '/js/pos-core.js', '/js/kitchen.js', '/css/pos.css', '/pos.webmanifest', '/kitchen.webmanifest', '/img/pos-192.png', '/img/pos-512.png', '/logo-light.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('twp-pos-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const key = url.pathname === '/pos.html' ? '/pos' : url.pathname === '/kitchen.html' ? '/kitchen' : url.pathname;
  if (!FILES.includes(key)) return;
  // network first so a new version shows up right away; the cache when offline
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
