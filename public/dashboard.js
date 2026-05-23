// ============================================
//   ZiBuy — Customer Dashboard
// ============================================

import { db, auth, collection, getDocs, query, where, deleteDoc, doc, updateDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let currentTab = "my-ads";

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadDashboard();
});

// ============================================
// LOAD DASHBOARD
// ============================================

async function loadDashboard() {
  const tab = new URLSearchParams(window.location.search).get("tab") || "my-ads";
  switchTab(tab);
}

// ============================================
// SWITCH TABS
// ============================================

window.switchTab = async function(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  event.target?.classList.add("active");
  
  // Update tab content
  document.querySelectorAll(".dashboard-tab").forEach(t => {
    t.classList.remove("active");
  });
  document.getElementById(`${tab}-tab`)?.classList.add("active");
  
  // Load content
  if (tab === "my-ads") {
    loadMyProducts();
  } else if (tab === "orders") {
    loadMyOrders();
  } else if (tab === "profile") {
    loadProfileSettings();
  }
};

// ============================================
// LOAD MY PRODUCTS
// ============================================

async function loadMyProducts() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const container = document.getElementById("my-ads-list");
    
    if (products.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#6b7280">
          <p style="font-size:48px;margin-bottom:12px">📦</p>
          <p style="font-size:16px;font-weight:700">No products posted yet</p>
          <p style="font-size:13px;margin-bottom:16px">Click the button below to post your first ad</p>
          <a href="post-ad.html" class="btn btn-orange" style="display:inline-block;padding:12px 24px;text-decoration:none">+ Post New Ad</a>
        </div>
      `;
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="ad-item">
        <div class="ad-item-image">
          <img src="${p.images?.[0] || 'https://via.placeholder.com/100'}" alt="${p.name}">
          <span class="ad-status-badge ${p.status === 'active' ? 'active' : 'sold'}">
            ${p.status === 'active' ? '✅ Active' : '❌ Sold'}
          </span>
        </div>
        <div class="ad-item-info">
          <h3>${p.name}</h3>
          <p class="ad-price">UGX ${Number(p.price).toLocaleString()}</p>
          <p class="ad-meta">📍 ${p.location} · 👁️ ${p.views || 0} views</p>
          <p class="ad-meta">📅 Posted: ${new Date(p.createdAt?.toDate?.() || p.createdAt).toLocaleDateString()}</p>
          
          <div class="ad-actions">
            <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-outline" onclick="markSold('${p.id}')">📦 Mark Sold</button>
            <button class="btn btn-sm" style="background:#ef4444;color:white;border:none" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Load products error:", err);
    document.getElementById("my-ads-list").innerHTML = `<p style="color:red">Error loading products: ${err.message}</p>`;
  }
}

// ============================================
// EDIT PRODUCT
// ============================================

window.editProduct = function(productId) {
  // Redirect to product page with edit mode
  window.location.href = `product.html?id=${productId}&edit=true`;
};

// ============================================
// MARK PRODUCT AS SOLD
// ============================================

window.markSold = async function(productId) {
  if (!confirm("Mark this product as sold?")) return;

  try {
    await updateDoc(doc(db, "products", productId), {
      status: "sold"
    });

    alert("✅ Product marked as sold");
    loadMyProducts();
  } catch (err) {
    console.error("Mark sold error:", err);
    alert("❌ Error: " + err.message);
  }
};

// ============================================
// DELETE PRODUCT
// ============================================

window.deleteProduct = async function(productId) {
  if (!confirm("Are you sure? This cannot be undone.")) return;

  try {
    await deleteDoc(doc(db, "products", productId));
    alert("✅ Product deleted");
    loadMyProducts();
  } catch (err) {
    console.error("Delete error:", err);
    alert("❌ Error: " + err.message);
  }
};

// ============================================
// LOAD MY ORDERS
// ============================================

async function loadMyOrders() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(query(
      collection(db, "orders"),
      where("userEmail", "==", currentUser.email)
    ));

    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const container = document.getElementById("orders-list");
    
    if (orders.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">No orders yet</p>`;
      return;
    }

    container.innerHTML = orders.map(o => `
      <div class="order-card">
        <h4>${o.orderId}</h4>
        <p><strong>Items:</strong> ${o.items?.length || 0} product(s)</p>
        <p><strong>Total:</strong> UGX ${Number(o.total).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="order-status">${o.status}</span></p>
        <p><strong>Delivery:</strong> ${o.customerLocation}</p>
        <p style="font-size:12px;color:#6b7280">Order Date: ${new Date(o.createdAt?.toDate?.() || o.createdAt).toLocaleDateString()}</p>
      </div>
    `).join("");

  } catch (err) {
    console.error("Load orders error:", err);
    document.getElementById("orders-list").innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}

// ============================================
// LOAD PROFILE SETTINGS
// ============================================

async function loadProfileSettings() {
  const container = document.getElementById("profile-settings");
  
  container.innerHTML = `
    <div class="settings-section">
      <h3>👤 Account Information</h3>
      <div style="padding:12px;background:#f3f4f6;border-radius:10px;margin-bottom:12px">
        <p style="margin:6px 0"><strong>Email:</strong> ${currentUser.email}</p>
        <p style="margin:6px 0"><strong>User ID:</strong> ${currentUser.uid}</p>
        <p style="margin:6px 0"><strong>Member Since:</strong> ${new Date(currentUser.metadata?.creationTime).toLocaleDateString()}</p>
      </div>
    </div>

    <div class="settings-section">
      <h3>🔐 Security</h3>
      <button class="btn btn-outline" onclick="changePassword()" style="width:100%;margin-bottom:8px">Change Password</button>
      <button class="btn btn-outline" style="width:100%" onclick="logout()">Logout</button>
    </div>

    <div class="settings-section" style="border:1px solid #fee2e2;background:#fee2e2">
      <h3 style="color:#991b1b">⚠️ Danger Zone</h3>
      <button class="btn" style="background:#ef4444;color:white;width:100%" onclick="deleteAccount()">Delete My Account</button>
    </div>
  `;
}

// ============================================
// CHANGE PASSWORD
// ============================================

window.changePassword = function() {
  alert("Password change feature coming soon");
  // Can use Firebase updatePassword()
};

// ============================================
// LOGOUT
// ============================================

window.logout = function() {
  auth.signOut().then(() => {
    alert("Logged out successfully");
    window.location.href = "index.html";
  });
};

// ============================================
// DELETE ACCOUNT
// ============================================

window.deleteAccount = function() {
  const confirm1 = confirm("This will permanently delete your account. Are you sure?");
  if (!confirm1) return;
  
  const confirm2 = confirm("This action CANNOT be undone. All your data will be lost. Continue?");
  if (!confirm2) return;

  alert("Account deletion coming soon - Contact support");
  // Can use Firebase deleteUser()
};