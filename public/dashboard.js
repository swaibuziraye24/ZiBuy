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
  console.log("Loading dashboard...");
  const tab = new URLSearchParams(window.location.search).get("tab") || "my-ads";
  
  // Set user email display
  if (currentUser) {
    document.getElementById("user-email").textContent = currentUser.email.split("@")[0];
    document.getElementById("user-email-display").textContent = currentUser.email;
  }
  
  await switchTab(tab);
}

// ============================================
// SWITCH TABS
// ============================================

window.switchTab = async function(tab) {
  currentTab = tab;
  console.log("Switching to tab:", tab);
  
  // Update nav buttons
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  
  document.querySelectorAll(".nav-item").forEach(btn => {
    const btnText = btn.textContent.toLowerCase();
    if (
      (tab === "my-ads" && btnText.includes("ads")) ||
      (tab === "orders" && btnText.includes("orders")) ||
      (tab === "profile" && btnText.includes("settings"))
    ) {
      btn.classList.add("active");
    }
  });
  
  // Update tab visibility
  document.querySelectorAll(".dashboard-tab").forEach(t => {
    t.classList.remove("active");
  });
  document.getElementById(`${tab}-tab`)?.classList.add("active");
  
  // Load content based on tab
  if (tab === "my-ads") {
    await loadMyProducts();
  } else if (tab === "orders") {
    await loadMyOrders();
  } else if (tab === "profile") {
    loadProfileSettings();
  }
};
  

async function loadMyProducts() {
  if (!currentUser) {
    console.warn("No current user");
    return;
  }

  const container = document.getElementById("my-ads-list");
  if (!container) {
    console.error("Container not found");
    return;
  }

  try {
    console.log("Loading products for user:", currentUser.uid);

    // Try querying by userId first, then by userEmail if empty
    let snapshot = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));

    // If no results, try by email
    if (snapshot.empty) {
      console.log("No products found by userId, trying userEmail...");
      snapshot = await getDocs(query(
        collection(db, "products"),
        where("userEmail", "==", currentUser.email)
      ));
    }

    console.log("Found products:", snapshot.size);

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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
          <img 
            src="${p.images?.[0] || 'https://via.placeholder.com/100'}" 
            alt="${p.name}"
            onerror="this.src='https://via.placeholder.com/100?text=No+Image'"
            style="width:100%;height:100%;object-fit:cover"
          >
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
            <button class="btn btn-sm btn-edit" onclick="editProduct('${p.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-sold" onclick="markSold('${p.id}')">✓ Sold</button>
            ${!p.isPremium ? `
              <button class="btn btn-sm btn-featured" onclick="boostFromDashboard('${p.id}', '${p.name.replace(/'/g, "\\'")}')">⭐ Boost</button>
            ` : `
              <button class="btn btn-sm" style="background:#10b981;color:white;border:none;cursor:default">✅ Featured</button>
            `}
            <button class="btn btn-sm btn-delete" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Load products error:", err);
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;background:#fee2e2;border-radius:12px">
        <p style="color:#991b1b;font-weight:700">❌ Error loading products</p>
        <p style="color:#991b1b;font-size:13px;margin-top:8px">${err.message}</p>
        <button class="btn btn-outline" onclick="loadMyProducts()" style="margin-top:12px">Try Again</button>
      </div>
    `;
  }
}

window.boostFromDashboard = async function(productId, productName) {
  const { boostAd } = await import("./premium-ads.js");
  
  if (!currentUser) {
    alert("Please login first");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal open";
  modal.id = "boost-modal-" + productId;
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <h2>⭐ Boost Your Ad</h2>
        <button class="modal-close" onclick="document.getElementById('boost-modal-${productId}')?.remove()">×</button>
      </div>
      
      <p style="color:#6b7280;margin-bottom:20px;font-size:15px">Make <strong>${productName}</strong> stand out and reach more buyers!</p>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', 7, 5000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">7 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 5,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', 14, 8000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">14 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 8,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', 30, 15000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">30 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 15,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>
      </div>

      <button class="btn btn-orange" onclick="confirmBoost('${productId}')" style="width:100%;padding:14px;font-size:15px;font-weight:800">Boost Now 🚀</button>
    </div>
  `;

  document.body.appendChild(modal);
};

window.selectBoostPlan = function(el, productId, days, price) {
  document.querySelectorAll(`input[name="boost-plan-${productId}"]`).forEach(r => r.checked = false);
  el.querySelector("input").checked = true;
  window.selectedBoostPlan = { productId, days, price };
};

window.confirmBoost = async function(productId) {
  if (!window.selectedBoostPlan) {
    alert("❌ Please select a boost plan");
    return;
  }

  if (!confirm(`Boost for ${window.selectedBoostPlan.days} days - UGX ${window.selectedBoostPlan.price.toLocaleString()}?`)) {
    return;
  }

  try {
    const { boostAd } = await import("./premium-ads.js");
    
    const success = await boostAd(
      window.selectedBoostPlan.productId,
      window.selectedBoostPlan.days,
      window.selectedBoostPlan.price
    );

    if (success) {
      document.getElementById("boost-modal-" + productId)?.remove();
      alert("✅ Ad boosted successfully! It's now featured.");
      loadMyProducts();
    } else {
      alert("❌ Boost failed. Please try again.");
    }
  } catch (err) {
    console.error("Boost error:", err);
    alert("❌ Error: " + err.message);
  }
};

// ============ EDIT PRODUCT ============
window.editProduct = function(productId) {
  window.location.href = `edit-product.html?id=${productId}`;
};

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