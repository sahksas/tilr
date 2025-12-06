/**
 * Service Worker for Tile Animation Viewer
 * バイナリチャンクのキャッシングを提供
 */

const CACHE_NAME = "tilr-cache-v1";

// インストール時にキャッシュを準備
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// フェッチリクエストをインターセプト
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // .binファイルのみをキャッシュ
  if (url.pathname.endsWith(".bin")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log(`Service Worker: Cache hit for ${url.pathname}`);
            return cachedResponse;
          }

          console.log(`Service Worker: Fetching ${url.pathname}`);
          return fetch(event.request).then((networkResponse) => {
            // キャッシュに保存
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
