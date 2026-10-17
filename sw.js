// Кэш игры. Имя кэша меняется с версией - старый кэш удаляется при обновлении.
// В кэш кладём только целые файлы: размер совпал с заявленным сервером.
// Запрос с ?r= (повтор после ошибки) всегда идёт в сеть и перезаписывает запись в кэше.
const VERSION = new URL(self.location).searchParams.get('v') || '0';
const CACHE = 'bulk2-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bulk') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// ответ целый? (если сервер назвал размер - он должен совпасть)
function whole(r) {
  return r.clone().arrayBuffer().then((ab) => {
    const len = r.headers.get('content-length');
    if (!ab.byteLength) return false;
    return !len || +len === ab.byteLength;
  }).catch(() => false);
}
const fail = () => new Response('', { status: 503, statusText: 'broken' });

function fromNet(req, key, store) {
  return fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-store' }).then((r) => {
    if (!r.ok) return r;
    return whole(r).then((ok) => {
      if (!ok) return fail();
      // копию снимаем сразу: после отдачи странице тело ответа уже будет прочитано
      if (store) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(key, cp)).catch(() => {}); }
      return r;
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isCode = req.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  // страница, скрипты и стили - сначала из сети (обновления приходят сразу), без сети - из кэша
  if (isCode) {
    e.respondWith(fromNet(req, req, true).then((r) => (r.ok ? r : caches.match(req).then((h) => h || r)))
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  // картинки и звуки: ключ без ?r=
  const clean = new URL(url); clean.searchParams.delete('r');
  const key = new Request(clean.href);
  if (url.searchParams.has('r')) { e.respondWith(fromNet(req, key, true).catch(fail)); return; }
  e.respondWith(caches.open(CACHE)
    .then((c) => c.match(key)).catch(() => null)
    .then((hit) => hit || fromNet(req, key, true))
    .catch(fail));
});
