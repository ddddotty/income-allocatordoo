/* 月收入分配計算機 — Service Worker
   提供離線使用：第一次載入後即可斷網開啟。
   每次發版時更動 CACHE 名稱，新版會自動安裝、頁面會自動 reload 套用。
   v20：install 與 navigate 改用 cache:'reload' 強制繞過瀏覽器 HTTP 快取，
        避免 GitHub Pages 的 10 分鐘快取讓新版抓不到。 */
const CACHE = 'income-allocator-v20';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  // 強制從網路重抓（繞過 HTTP 快取），安裝完直接成為 active
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      ASSETS.map(u => fetch(new Request(u, { cache: 'reload' }))
        .then(r => { if (r && (r.ok || r.type === 'opaque')) return c.put(u, r); })
        .catch(() => {}))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // navigate / index.html / sw.js 採用 network-first 且繞過 HTTP 快取，確保新版能被偵測
  const isNav = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/sw.js');
  if (isNav) {
    e.respondWith(
      fetch(e.request.url, { cache: 'reload' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // 其餘採用 cache-first
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
