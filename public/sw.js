const CACHE_NAME = "delta-mining-ops-v19-maintenance-costs-20260909";
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
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(new Request(url,{cache:"reload"}))));
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

self.addEventListener("message", event=>{
  if(event?.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NUNCA servir HTML/JS/CSS viejo cuando hay red. El Dashboard depende de que
  // todas las PCs ejecuten exactamente la misma versión del bundle desplegado.
  const isExecutable =
    request.mode === "navigate" ||
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/sw.js" ||
    /\.(?:js|mjs|css)(?:$|\?)/i.test(url.pathname + url.search);

  if (isExecutable) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        if(url.pathname!=="/sw.js"){
          await safePut(cache, request.mode === "navigate" ? "/index.html" : request, response);
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) ||
          (request.mode === "navigate" ? await cache.match("/index.html") : null) ||
          Response.error();
      }
    })());
    return;
  }

  // Recursos puramente estáticos pueden conservar cache offline.
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
