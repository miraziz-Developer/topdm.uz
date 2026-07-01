const CACHE = "bozor-offline-v2";
const PRECACHE = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/pwa-icon/192",
  "/pwa-icon/512",
  "/apple-icon",
  "/brand/bozorliii-icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isMapApi(url) {
  return url.pathname.includes("/api/v1/indoor-maps/");
}

function isAppShell(url) {
  return (
    url.pathname.startsWith("/pwa-icon/") ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/apple-splash" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.origin.includes(self.location.origin) && !url.pathname.includes("/api/v1/indoor-maps")) {
    return;
  }

  if (isAppShell(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
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
            const fallback = (await caches.match("/offline")) || (await caches.match("/"));
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
