// ============================================
//   ZiBuy — Service Worker
//   Offline-first caching strategy
// ============================================

const CACHE_NAME    = "zibuy-v1";
const OFFLINE_URL   = "/offline.html";

// Static assets to cache immediately on install
const PRECACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/offline.html",
  "/manifest.json",
  "/my_logo.png"
];

// ── Install: cache core assets ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: smart caching strategy ────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, Firebase API requests
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("googleapis.com")
  ) {
    return;
  }

  // ── HTML pages: Network first, fallback to cache ──
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ── CSS / JS / fonts: Cache first, update in background ──
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")  ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || network;
      })
    );
    return;
  }

  // ── Images: Cache first ───────────────────────
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ── Everything else: Network first ───────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});