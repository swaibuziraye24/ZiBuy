import { db, auth, collection, getDocs, query, where, updateDoc, doc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let allNotifications = [];
let currentFilter = "all";

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadNotifications();
});

async function loadNotifications() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid)
    ));

    allNotifications = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    renderNotifications();
  } catch (err) {
    console.error(err);
    document.getElementById("notifications-list").innerHTML = "<p style='color:red'>Failed to load notifications</p>";
  }
}

function renderNotifications() {
  const container = document.getElementById("notifications-list");
  
  let filtered = allNotifications;

  if (currentFilter === "unread") {
    filtered = allNotifications.filter(n => !n.read);
  } else if (currentFilter !== "all") {
    filtered = allNotifications.filter(n => n.type === currentFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#6b7280">
        <p style="font-size:32px;margin-bottom:12px">🔔</p>
        <p>No notifications yet</p>
      </div>`;
    return;
  }

 container.innerHTML = filtered.map(notif => `
    <div class="notification-item ${notif.read ? "read" : "unread"}" onclick="handleNotificationClick('${notif.id}', '${notif.type || ""}', '${notif.relatedId || ""}')">
      <div class="notification-icon">
        ${getIcon(notif.type)}
      </div>
      <div class="notification-content">
        <h3>${notif.title}</h3>
        <p>${notif.message}</p>
        <span class="notification-time">${getTimeAgo(notif.createdAt.toDate())}</span>
      </div>
      ${!notif.read ? '<span class="unread-dot"></span>' : ''}
    </div>
  `).join("");
}

function getIcon(type) {
  const icons = {
    message: "💬",
    order: "📦",
    review: "⭐",
    ad_view: "👁️",
    payment: "💳"
  };
  return icons[type] || "🔔";
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
  
  return date.toLocaleDateString();
}

window.filterNotifications = function(filter) {
  currentFilter = filter;
  document.querySelectorAll(".notif-filter").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  renderNotifications();
};

window.markRead = async function(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    loadNotifications();
  } catch (err) {
    console.error(err);
  }
};

// ── Route notification clicks to the right page ──
window.handleNotificationClick = async function(notificationId, type, relatedId) {
  await markRead(notificationId);

  if (type === "message" && relatedId) {
    // relatedId holds the sender's email — jump straight into that chat
    window.location.href = `messages.html?to=${encodeURIComponent(relatedId)}`;
    return;
  }

  if (type === "order" && relatedId) {
    window.location.href = `dashboard.html?tab=orders`;
    return;
  }

  if (type === "review") {
    window.location.href = `dashboard.html?tab=myprofile`;
    return;
  }

  if ((type === "plan_expiry" || type === "boost_expiry") && relatedId) {
    window.location.href = relatedId;
    return;
  }

  if (type === "broadcast" && relatedId) {
    window.location.href = relatedId === "/" ? "index.html" : relatedId;
    return;
  }

  // Default: stay on notifications page (already marked read)
};

// Mark all as read
window.markAllRead = async function() {
  try {
    for (const notif of allNotifications.filter(n => !n.read)) {
      await updateDoc(doc(db, "notifications", notif.id), { read: true });
    }
    loadNotifications();
  } catch (err) {
    console.error(err);
  }
};