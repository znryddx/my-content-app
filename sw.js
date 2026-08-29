// 离线兜底 Service Worker
// 目的：网络被重置/限速时，App 仍能用缓存秒开，而不是白屏或 ERR_CONNECTION_RESET。
// 策略：网络优先（带超时）-> 失败则回退缓存；同时把新内容写回缓存，保证下次更新。

const CACHE = 'mycontent-v1';
const PRECACHE = [
  './',
  './index.html',
  './app.min.js',
  './app.js',
  './isometric.min.js',
  './isometric.js',
  './config.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        resolve(res);
      } else {
        reject(new Error('HTTP ' + (res && res.status)));
      }
    }).catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function handle(req) {
  // 页面导航：给足 6 秒，超时就用缓存开门
  const isNav = req.mode === 'navigate';
  const timeout = isNav ? 6000 : 5000;
  try {
    return await networkFirst(req, timeout);
  } catch (e) {
    const hit = await caches.match(req, { ignoreSearch: false });
    if (hit) return hit;
    if (isNav) {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(handle(req));
});
