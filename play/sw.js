/* Offline support for the web / iPhone version: always try the internet first (so updates
   arrive right away) and fall back to the last saved copy when there is no connection. */
const CACHE = 'omamj-web-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;     // the database etc. go straight to the network
  if (/\/(version|bundle)\.json$/.test(url.pathname)) return;           // update checks are never cached
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html', { ignoreSearch: true })))
  );
});
