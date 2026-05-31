// ============================================
//   ZiBuy — Service Worker
//   Offline-first PWA strategy
// ============================================

const CACHE_NAME   = "zibuy-v1";
const OFFLINE_PAGE = "/offline.html";

const PRECACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/offline.html",
  "/my_logo.png",
  "/manifest.json",
  "/app.js",
  "/firebase.js",
  "/nav.js",
  "/product.html",
  "/post-ad.html",
  "/dashboard.html",
  "/messages.html",
  "/notifications.html",
  "/payment.html",
  "/shops.html",
  "/shop.html",
  "/business-plans.html",
  "/boost-product.html",
];

// ── Install ───────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch((err) => console.warn("[SW] Pre-cache partial failure:", err))
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Firebase/Google API calls
  if (request.method !== "GET") return;
  if (url.hostname.includes("googleapis.com")) return;
  if (url.hostname.includes("gstatic.com")) return;
  if (url.hostname.includes("firestore")) return;
  if (url.hostname.includes("firebase")) return;
  if (url.pathname.startsWith("/__")) return;

  // HTML: network first → cache → offline page
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // CSS / JS / Images: cache first, update in background
  if (/\.(css|js|png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          }).catch(() => null);
          return cached || network;
        })
      )
    );
    return;
  }

  // Everything else: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push Notifications ────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "ZiBuy", {
      body:  data.body  || "You have a new notification",
      icon:  data.icon  || "/my_logo.png",
      badge: "/my_logo.png",
      data:  data.url   || "/"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || "/"));
});