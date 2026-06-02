// firebase-messaging-sw.js
// Must be in root folder — same level as index.html

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyDc7-XKk30DshUE-9PUoMF4VObt4UTIncM",
  authDomain:        "zibuy-5deae.firebaseapp.com",
  projectId:         "zibuy-5deae",
  storageBucket:     "zibuy-5deae.firebasestorage.app",
  messagingSenderId: "283997357155",
  appId:             "1:283997357155:web:de76cef72c6b278afda456"
});

const messaging = firebase.messaging();

// Background push notifications (when tab is closed/hidden)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "ZiBuy";
  const body  = payload.notification?.body  || "You have a new notification";
  const icon  = payload.notification?.icon  || "/my_logo.png";

  self.registration.showNotification(title, {
    body,
    icon,
    badge: "/my_logo.png",
    data:  payload.data || {},
    vibrate: [200, 100, 200]
  });
});

// Notification click — open app or specific URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "https://zibuy-5deae.web.app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app already open, focus it
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});