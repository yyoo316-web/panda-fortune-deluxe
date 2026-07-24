// Panda Fortune Deluxe — service worker (v5.3.1)
// Cache-first strategy for the app shell + art assets so the game works offline
// once loaded.
const CACHE_NAME = "pfd-v5-3-1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./sound.js",
  "./manifest.json",
  "./assets/symbols/01-giant-panda.webp",
  "./assets/symbols/02-pink-panda.webp",
  "./assets/symbols/03-red-lantern.webp",
  "./assets/symbols/04-golden-teapot.webp",
  "./assets/symbols/05-wild-bamboo.webp",
  "./assets/symbols/06-scatter-medal.webp",
  "./assets/symbols/07-letter-a.webp",
  "./assets/symbols/08-letter-k.webp",
  "./assets/symbols/09-letter-q.webp",
  "./assets/symbols/10-letter-j.webp",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => cached);
    })
  );
});
