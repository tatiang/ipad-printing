const CACHE = "photo-sheet-v1.01-shell-1";
const SHELL = [
  "./",
  "./index.html",
  "./style_v1.00.css",
  "./app_v1.00.js",
  "./images_v1.00.js",
  "./geometry_v1.00.mjs",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
const shellURLs = new Set(
  SHELL.map((path) => new URL(path, self.registration.scope).href),
);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  // Do not replace the worker beneath a live photo-editing session.
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("photo-sheet-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  // Strict app-shell allowlist: no photos, Blob URLs, APIs, query strings or unrelated files.
  if (event.request.method !== "GET" || !shellURLs.has(event.request.url))
    return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) =>
          (await cache.match(event.request)) || fetch(event.request),
      ),
  );
});
