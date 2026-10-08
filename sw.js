/* Lift service worker. One versioned cache per build: the page and its shell load with no network (the gym), and a new build replaces the old cache.
   Strategy: network first (always revalidated, so a host's own max-age cannot hide a new build) with a short timeout, so a deployed update is picked up whenever there is signal and the cached copy is used when there is not.
   It never touches your data (that lives in localStorage), and it only handles same-origin GET requests. */
const CACHE = 'lift-9be22ce7c4', ASSETS = ['./', './index.html'], SLOW_MS = 3500;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('lift-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE), net = fetch(r, { cache: 'no-cache' }).then(res => { if (res && res.ok) c.put(r, res.clone()); return res; });
    e.waitUntil(net.catch(() => {}));
    try { return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), SLOW_MS))]); }
    catch (_) { const hit = (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('./index.html') : null); if (hit) return hit; return net.catch(() => new Response('Offline', { status: 503 })); }
  })());
});
