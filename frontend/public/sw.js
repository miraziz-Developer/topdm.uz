const CACHE = "bozor-offline-v1";
const PRECACHE = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isMapApi(url) {
  return url.pathname.includes("/api/v1/indoor-maps/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.origin.includes(self.location.origin) && !url.pathname.includes("/api/v1/indoor-maps")) {
    return;
  }

  if (isMapApi(url) || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const fallback = await caches.match("/");
            if (fallback) return fallback;
          }
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }),
    );
  }
});
