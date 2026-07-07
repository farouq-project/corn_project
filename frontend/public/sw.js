// Corn Breed UNPAD — Service Worker
const CACHE = "cornbreed-v1";
const STATIC = ["/", "/dashboard", "/login", "/manifest.json", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Only cache GET requests to same origin
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Don't cache API calls
  if (url.pathname.startsWith("/api/") || url.hostname !== self.location.hostname) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request).then((res) => {
        if (res.ok && url.pathname.startsWith("/_next/static/")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached ?? networkFetch;
    })
  );
});
