// ============================================
//   ZiBuy — Notifications Setup
//   FCM token registration + in-app real-time
//   Add <script type="module" src="notifications-setup.js">
//   to every page
// ============================================

import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Your FCM VAPID key from Firebase Console ─
// Go to: Firebase Console → Project Settings
//        → Cloud Messaging → Web Push certificates
//        → Generate key pair → copy the key
const VAPID_KEY =
  "BEwjEXMtllcAlNaSA6j4O3fRro9XgpiafUdESOgf8iEIsPeFD1UcS7bzCH1agpNT4dFdfNSr1VGhAemgJ58AGw0";


// ══════════════════════════════════════════════
//  1. REQUEST PERMISSION + SAVE FCM TOKEN
// ══════════════════════════════════════════════
export async function setupPushNotifications(userId) {
  try {
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const { getMessaging, getToken } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js"
    );
    const { app } = await import("./firebase.js");

    const messaging = getMessaging(app);
    const swReg     = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey:              VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) return;

    // Save token to Firestore under user doc
    await updateDoc(doc(db, "users", userId), {
      fcmToken:       token,
      fcmTokenUpdated: new Date(),
      notificationsEnabled: true
    });

    console.log("[FCM] Token saved");
  } catch (e) {
    console.warn("[FCM] Setup failed:", e.message);
  }
}

// ══════════════════════════════════════════════
//  2. REAL-TIME IN-APP NOTIFICATION BADGE
// ══════════════════════════════════════════════
export function listenUnreadNotifications(userId) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read",   "==", false)
  );

  return onSnapshot(q, (snap) => {
    const count = snap.size;

    // Update notifications button badge
    const notifBtn = document.getElementById("notifications-btn");
    if (notifBtn) {
      notifBtn.innerHTML = count > 0
        ? `🔔 <span style="background:#ef4444;color:white;border-radius:50%;padding:1px 5px;font-size:10px;font-weight:800">${count}</span>`
        : "🔔 Notifications";
    }

    // Update nav badge
    const navBell = document.getElementById("nav-notif-badge");
    if (navBell) {
      navBell.textContent   = count;
      navBell.style.display = count > 0 ? "flex" : "none";
    }

    // Show browser notification for new ones (only if page is hidden)
    snap.docChanges().forEach((change) => {
      if (change.type === "added" && document.hidden) {
        const n = change.doc.data();
        if (Notification.permission === "granted") {
          new Notification(n.title || "ZiBuy", {
            body:  n.message || "",
            icon:  "/my_logo.png",
            badge: "/my_logo.png",
            tag:   change.doc.id
          });
        }
      }
    });
  });
}

// ══════════════════════════════════════════════
//  3. CREATE NOTIFICATION HELPER (shared)
// ══════════════════════════════════════════════
export async function createNotification(userId, type, title, message, relatedId = null) {
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      type,      // "boost" | "plan" | "order" | "message" | "offer" | "broadcast"
      title,
      message,
      relatedId,
      read:      false,
      createdAt: new Date()
    });
  } catch (e) {
    console.warn("createNotification failed:", e.message);
  }
}

// ══════════════════════════════════════════════
//  4. LISTEN TO BROADCASTS (best offers, deals)
// ══════════════════════════════════════════════
export function listenBroadcasts() {
  const q = query(
    collection(db, "broadcasts"),
    where("active", "==", true)
  );

  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const b = change.doc.data();
        showInAppBanner(b.title, b.message, b.url || "/");
      }
    });
  });
}

function showInAppBanner(title, message, url) {
  const existing = document.getElementById("zibuy-broadcast-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "zibuy-broadcast-banner";
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99999;
    background:linear-gradient(135deg,#ff6600,#ff9900);
    color:white;padding:12px 16px;
    display:flex;align-items:center;justify-content:space-between;
    gap:12px;box-shadow:0 4px 16px rgba(255,102,0,.4);
    font-family:Arial,sans-serif;
    animation:slideDown .3s ease;
  `;

  const style = document.createElement("style");
  style.textContent = `@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}`;
  document.head.appendChild(style);

  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      <span style="font-size:20px;flex-shrink:0">🔥</span>
      <div style="min-width:0">
        <p style="margin:0;font-weight:800;font-size:13px">${title}</p>
        <p style="margin:2px 0 0;font-size:12px;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${message}</p>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      ${url !== "/" ? `<button onclick="window.location.href='${url}'" style="background:white;color:#ff6600;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">View</button>` : ""}
      <button onclick="document.getElementById('zibuy-broadcast-banner').remove()" style="background:rgba(255,255,255,.2);color:white;border:none;width:28px;height:28px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
    </div>
  `;

  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
}

// ══════════════════════════════════════════════
//  5. AUTO-INIT ON AUTH
// ══════════════════════════════════════════════
let unsubNotif     = null;
let unsubBroadcast = null;

onAuthStateChanged(auth, (user) => {
  if (unsubNotif)     { unsubNotif();     unsubNotif     = null; }
  if (unsubBroadcast) { unsubBroadcast(); unsubBroadcast = null; }

  if (user) {
    // Ask permission + save FCM token
    setupPushNotifications(user.uid);

    // Live badge on bell icon
    unsubNotif = listenUnreadNotifications(user.uid);
  }

  // Broadcasts work for everyone (guests too)
  unsubBroadcast = listenBroadcasts();
});