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
    payment: "💳",
    price_drop: "📉",
    back_in_stock: "🛍️"
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


window.handleNotificationClick = async function(notificationId, type, relatedId) {
  await markRead(notificationId);

  if (type === "message" && relatedId) {
    // relatedId holds the sender's email — jump straight into that chat
    window.location.href = `messages.html?to=${encodeURIComponent(relatedId)}`;
    return;
  }

  if (type === "order") {
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

  if (type === "feature_update") {
    showUpdatesPanel();
    return;
  }

  // Default: stay on notifications page (already marked read)
};

// ── Route notification clicks to the right page ──
window.handleNotificationClick = async function(notificationId, type, relatedId) {
  await markRead(notificationId);

  if (type === "message" && relatedId) {
    // relatedId holds the sender's email — jump straight into that chat
    window.location.href = `messages.html?to=${encodeURIComponent(relatedId)}`;
    return;
  }

  if ((type === "back_in_stock" || type === "price_drop") && relatedId) {
    window.location.href = `product.html?id=${encodeURIComponent(relatedId)}`;
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

  if (type === "feature_update") {
    showUpdatesPanel();
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


// ── ZiBuy Updates: a one-way feed shown right on the Alerts page ──
function escUpd(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

window.showUpdatesPanel = async function() {
  const panel = document.getElementById("updates-panel");
  if (!panel) return;

  panel.style.display = "block";
  panel.innerHTML = `<p style="text-align:center;color:#6b7280;padding:20px">Loading updates…</p>`;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const snap = await getDocs(collection(db, "feature_updates"));
    const updates = snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (updates.length === 0) {
      panel.innerHTML = `<p style="text-align:center;color:#6b7280;padding:20px">No updates yet</p>`;
      return;
    }

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0;font-size:16px;font-weight:800">🎓 ZiBuy Updates</h2>
        <a href="javascript:void(0)" onclick="document.getElementById('updates-panel').style.display='none'"
          style="font-size:12px;font-weight:700;color:#9ca3af;text-decoration:none">Close</a>
      </div>
      ${updates.map(u => {
        const date = u.createdAt?.toDate
          ? u.createdAt.toDate().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
          : "";
        return `
        <div style="background:white;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,0.06)">
          <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase">${date}</p>
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#111827">${escUpd(u.title)}</h3>
          ${u.text ? `<p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap">${escUpd(u.text)}</p>` : ""}
          ${u.videoUrl ? `<video controls style="width:100%;border-radius:12px;margin-bottom:10px;background:#000"><source src="${u.videoUrl}"></video>` : ""}
          ${u.audioUrl ? `<audio controls style="width:100%"><source src="${u.audioUrl}"></audio>` : ""}
        </div>`;
      }).join("")}
    `;
  } catch (e) {
    console.error("updates panel:", e);
    panel.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px">Couldn't load updates</p>`;
  }
};