// ============================================
// ZiBuy Firebase Messaging Service Worker
// ============================================

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDc7-XKk30DshUE-9PUoMF4VObt4UTIncM",
  authDomain: "zibuy-5deae.firebaseapp.com",
  projectId: "zibuy-5deae",
  storageBucket: "zibuy-5deae.firebasestorage.app",
  messagingSenderId:  "283997357155",
  appId:  "1:283997357155:web:de76cef72c6b278afda456"
});

const messaging = firebase.messaging();

/* ==========================================
   Background Notifications
========================================== */

messaging.onBackgroundMessage((payload) => {

  console.log(
    "[firebase-messaging-sw.js] Background Message:",
    payload
  );

  const notificationTitle =
    payload.notification?.title || "ZiBuy";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      "You have a new notification",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {}
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});

/* ==========================================
   Notification Click
========================================== */

self.addEventListener(
  "notificationclick",
  (event) => {

    event.notification.close();

    const url =
      event.notification.data?.url || "/";

    event.waitUntil(
      clients.openWindow(url)
    );

  }
);