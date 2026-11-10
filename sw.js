// Offline-Hülle: App-Dateien sofort aus dem Speicher, im Hintergrund aktualisieren
const V = 'board228-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'icon.svg', 'manifest.webmanifest', 'js/app.js', 'js/store.js', 'js/util.js', 'js/cards.js', 'js/rich.js', 'js/table.js', 'js/sketch.js', 'js/ui.js', 'js/actions.js', 'js/exporter.js', 'js/templates.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  const own = u.origin === location.origin, lib = u.hostname === 'cdn.jsdelivr.net';
  if (!own && !lib) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: own });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return lib ? hit || net : net;
  }));
});
