// ============================================
//   ZiBuy — User Dashboard
// ============================================

import {
  db, auth,
  collection, getDocs, query, where, doc, updateDoc, deleteDoc
} from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============ State ============
let currentUser = null;
let currentFilter = "all";
let userPhone = "";

// ============ AUTH CHECK ============
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Redirect if not logged in
    document.body.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <h2>You must be logged in</h2>
        <p style="color:#6b7280;margin:20px 0">Please sign in to access your dashboard</p>
        <button class="btn btn-orange" onclick="window.location.href='index.html'" style="padding:14px 28px;font-size:16px">
          Go to ZiBuy Home
        </button>
      </div>
    `;
    return;
  }

  currentUser = user;
  loadDashboard();
});

// ============ LOAD DASHBOARD ============
async function loadDashboard() {
  if (!currentUser) return;

  // Load profile
  const name = currentUser.email.split("@")[0];
  document.getElementById("user-name").textContent = name;
  document.getElementById("user-email").textContent = currentUser.email;
  document.getElementById("profile-name").textContent = name;
  document.getElementById("profile-email").textContent = currentUser.email;
  document.getElementById("profile-joined").textContent = new Date(currentUser.metadata.creationTime).toLocaleDateString();
  document.getElementById("account-btn").textContent = "👤 " + name;

  // Load phone (from localStorage for now)
  userPhone = localStorage.getItem(`zibuy-user-phone-${currentUser.uid}`) || "";
  document.getElementById("profile-phone").textContent = userPhone || "(Not provided)";

  // Load stats
  await loadStats();

  // Load my ads
  await loadMyAds();

  // Load my orders
  await loadMyOrders();
}

// ============ TAB SWITCHING ============
window.switchTab = function(tab) {
  // Hide all tabs
  document.querySelectorAll(".dashboard-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  // Show selected tab
  document.getElementById(`tab-${tab}`).classList.add("active");
  event.target.closest(".nav-item").classList.add("active");

  // Load data if needed
  if (tab === "my-ads") loadMyAds();
  if (tab === "my-orders") loadMyOrders();
};

// ============ LOAD STATS ============
async function loadStats() {
  try {
    // Get user's ads
    const adsSnap = await getDocs(query(collection(db, "products"), where("userId", "==", currentUser.uid)));
    let totalViews = 0;
    adsSnap.forEach(doc => {
      totalViews += doc.data().views || 0;
    });

    // Get user's orders
    const ordersSnap = await getDocs(query(collection(db, "orders"), where("userEmail", "==", currentUser.email)));
    let totalSpent = 0;
    ordersSnap.forEach(doc => {
      totalSpent += doc.data().total || 0;
    });

    document.getElementById("stat-ads").textContent = adsSnap.size;
    document.getElementById("stat-views").textContent = totalViews.toLocaleString();
    document.getElementById("stat-orders").textContent = ordersSnap.size;
    document.getElementById("stat-spent").textContent = "UGX " + totalSpent.toLocaleString();
  } catch (err) {
    console.error(err);
  }
}

// ============ LOAD MY ADS ============
async function loadMyAds() {
  const container = document.getElementById("my-ads-list");
  container.innerHTML = "<p style='color:#6b7280;text-align:center;padding:20px'>Loading your ads...</p>";

  try {
    const snapshot = await getDocs(query(collection(db, "products"), where("userId", "==", currentUser.uid), where("isUserPost", "==", true)));

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <p style="font-size:32px;margin-bottom:12px">📢</p>
          <p style="color:#6b7280;margin-bottom:20px">You haven't posted any ads yet</p>
          <button class="btn btn-orange" onclick="window.location.href='post-ad.html'">Post Your First Ad</button>
        </div>`;
      return;
    }

    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const ad = docSnap.data();
      const images = Array.isArray(ad.images) ? ad.images : [];
      const status = ad.status || "active";
      const daysOld = Math.floor((Date.now() - ad.createdAt.toDate()) / (1000 * 60 * 60 * 24));
      const isExpired = daysOld > 30;

      if (currentFilter !== "all") {
        if (currentFilter === "active" && (status !== "active" || isExpired)) return;
        if (currentFilter === "sold" && status !== "sold") return;
        if (currentFilter === "expired" && !isExpired) return;
      }

      const card = document.createElement("div");
      card.className = "ad-item";
      card.innerHTML = `
        <div class="ad-item-image">
          <img src="${images[0] || ''}" alt="${ad.name}">
          <span class="ad-status-badge ${status === "sold" ? "sold" : isExpired ? "expired" : "active"}">
            ${status === "sold" ? "SOLD" : isExpired ? "EXPIRED" : "ACTIVE"}
          </span>
        </div>
        <div class="ad-item-info">
          <h3>${ad.name}</h3>
          <p class="ad-price">UGX ${Number(ad.price).toLocaleString()}</p>
          <p class="ad-meta">📍 ${ad.location || "Uganda"} • 👁️ ${ad.views || 0} views • ${daysOld} days ago</p>
          <div class="ad-actions">
            <button class="btn btn-outline btn-sm" onclick="editAd('${docSnap.id}')">Edit</button>
            <button class="btn btn-outline btn-sm" onclick="markAsSold('${docSnap.id}')">Mark Sold</button>
            <button class="btn btn-outline btn-sm" style="color:#ef4444;border-color:#ef4444" onclick="deleteAd('${docSnap.id}')">Delete</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load ads</p>";
  }
}

window.filterMyAds = function(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  loadMyAds();
};

window.editAd = function(adId) {
  showToast("Edit feature coming soon!", "info");
};

window.markAsSold = async function(adId) {
  if (!confirm("Mark this ad as sold?")) return;
  try {
    await updateDoc(doc(db, "products", adId), { status: "sold" });
    showToast("Ad marked as sold ✓", "success");
    loadMyAds();
  } catch (err) {
    showToast("Failed to update ad", "error");
  }
};

window.deleteAd = async function(adId) {
  if (!confirm("Delete this ad? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "products", adId));
    showToast("Ad deleted ✓", "success");
    loadMyAds();
    loadStats();
  } catch (err) {
    showToast("Failed to delete ad", "error");
  }
};

// ============ LOAD MY ORDERS ============
async function loadMyOrders() {
  const container = document.getElementById("my-orders-list");
  container.innerHTML = "<p style='color:#6b7280;text-align:center;padding:20px'>Loading your orders...</p>";

  try {
    const snapshot = await getDocs(query(collection(db, "orders"), where("userEmail", "==", currentUser.email)));

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <p style="font-size:32px;margin-bottom:12px">📦</p>
          <p style="color:#6b7280;margin-bottom:20px">You haven't placed any orders yet</p>
          <button class="btn btn-orange" onclick="window.location.href='index.html'">Start Shopping</button>
        </div>`;
      return;
    }

    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const orderId = order.orderId || docSnap.id;
      const date = new Date(order.createdAt.toDate()).toLocaleDateString();

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-header">
          <h3>${orderId}</h3>
          <span class="order-date">${date}</span>
        </div>
        <div class="order-items">
          ${order.items.map(item => `
            <p>• ${item.name} × ${item.qty}</p>
          `).join("")}
        </div>
        <div class="order-footer">
          <p><strong>Total:</strong> UGX ${(order.total || 0).toLocaleString()}</p>
          <p><strong>Status:</strong> <span class="order-status">${order.status || "Pending"}</span></p>
          <p><strong>Location:</strong> ${order.customerLocation}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load orders</p>";
  }
}

// ============ PHONE NUMBER ============
window.editPhone = function() {
  document.getElementById("edit-phone-modal").classList.add("open");
  document.getElementById("new-phone").value = userPhone;
};

window.closeEditPhoneModal = function() {
  document.getElementById("edit-phone-modal").classList.remove("open");
};

window.savePhone = function() {
  const phone = document.getElementById("new-phone").value.trim();
  if (!phone) {
    showToast("Please enter a phone number", "error");
    return;
  }

  // Save to localStorage (you could also save to Firestore in a "users" collection)
  localStorage.setItem(`zibuy-user-phone-${currentUser.uid}`, phone);
  userPhone = phone;
  document.getElementById("profile-phone").textContent = phone;
  closeEditPhoneModal();
  showToast("Phone number updated ✓", "success");
};

// ============ DELETE ACCOUNT ============
window.deleteAccount = function() {
  if (!confirm("Are you sure? This will delete your account and all your data. This cannot be undone.")) return;
  if (!confirm("Type DELETE to confirm deletion")) return;

  showToast("Account deletion coming soon", "info");
};

// ============ AUTH FUNCTIONS ============
window.customerRegister = async function() {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showToast("Account created!", "success");
    closeAuthModal();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.customerLogin = async function() {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Login successful! 👋", "success");
    closeAuthModal();
  } catch (err) {
    showToast("Invalid email or password", "error");
  }
};

window.customerLogout = async function() {
  await signOut(auth);
  showToast("Logged out ✓", "info");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000);
};

window.openAuthModal = function() {
  document.getElementById("auth-modal").classList.add("open");
};

window.closeAuthModal = function() {
  document.getElementById("auth-modal").classList.remove("open");
};

// ============ TOAST ============
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = { success: "✅", error: "❌", info: "🔔" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.showToast = showToast;