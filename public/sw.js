// ============================================
//   ZiBuy — Service Worker
//   Offline-first PWA strategy
// ============================================

const CACHE_NAME   = "zibuy-v2";
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
  const requestClone = event.request.clone();
  event.respondWith(
    fetch(requestClone)
      .then((res) => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push Notifications ────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "ZiBuy", body: event.data.text() };
  }

  // Support both flat {title,body} and nested {notification:{title,body}}
  const title = data.title || data.notification?.title || "ZiBuy";
  const body   = data.body  || data.notification?.body  || "You have a new notification";
  const icon   = data.icon  || data.notification?.icon  || "/my_logo.png";
  const url    = data.url   || data.data?.url            || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:   "/my_logo.png",
      vibrate: [200, 100, 200],
      data:    { url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});