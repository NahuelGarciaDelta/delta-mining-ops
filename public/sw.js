const CACHE_NAME = "delta-mining-ops-v14-live-data-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/loader.gif"
];

async function safePut(cache, request, response) {
  try {
    if (!response || !response.ok || response.status === 206) return;
    if (response.type !== "basic" && response.type !== "default") return;
    await cache.put(request, response.clone());
  } catch (error) {
    console.debug("[SW] cache omitido", error?.message || error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación y assets ejecutables: RED primero. Así dos PCs no quedan corriendo
  // versiones distintas del frontend por stale-while-revalidate.
  const isExecutable = request.mode === "navigate" || request.destination === "script" || request.destination === "style" || /\.(?:js|mjs|css)(?:$|\?)/i.test(url.pathname + url.search);
  if (isExecutable) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        await safePut(cache, request.mode === "navigate" ? "/index.html" : request, response);
        return response;
      } catch (_) {
        return (await cache.match(request)) || (request.mode === "navigate" ? await cache.match("/index.html") : null) || Response.error();
      }
    })());
    return;
  }

  // Imágenes y demás recursos estáticos sí pueden usar cache para conservar modo offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(async (response) => {
      await safePut(cache, request, response);
      return response;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
