// ============================================
//   ZiBuy — Customer Dashboard
// ============================================

// ✅ NEW
import { db, auth, collection, getDocs, addDoc, query, where, updateDoc, deleteDoc, doc, getDoc, serverTimestamp  } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { runSubscriptionExpiryCheck } from "./subscription-check.js";

runSubscriptionExpiryCheck();

console.log("📊 Dashboard.js loaded");

const originalLog = console.log;
window.debugDashboard = true;

function debug(msg, data) {
  if (window.debugDashboard) {
    originalLog("🔍 [DASHBOARD]", msg, data || "");
  }
}

let currentUser = null;
let currentTab = "my-ads";

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  debug("Auth state changed. User:", user?.email);
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadDashboard();
});

// ============================================
// LOAD DASHBOARD (SINGLE DEFINITION)
// ============================================

async function loadDashboard() {
  debug("loadDashboard() called");
  debug("currentUser:", currentUser?.email);

  const tab = new URLSearchParams(window.location.search).get("tab") || "my-ads";
  debug("Tab from URL:", tab);
  
  if (currentUser) {
    const nameEl = document.getElementById("user-email");
    const emailEl = document.getElementById("user-email-display");
    
    debug("Setting user email display...");
    debug("nameEl found:", !!nameEl);
    debug("emailEl found:", !!emailEl);
    
    if (nameEl) nameEl.textContent = currentUser.email.split("@")[0];
    if (emailEl) emailEl.textContent = currentUser.email;
  }
  
  debug("Calling switchTab with:", tab);
  await switchTab(tab);
}

// ============================================
// SWITCH TAB
// ============================================

window.switchTab = async function(tabName) {

  debug("switchTab() called with:", tabName);

  // Hide all tabs
  document.querySelectorAll(".dashboard-tab").forEach(tabEl => {
    tabEl.style.display = "none";
    tabEl.classList.remove("active");
  });

  // Remove active nav buttons
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
  });

  let tabId = "";

  if (tabName === "my-ads") {
    tabId = "my-ads-tab";
  }

  else if (tabName === "orders") {
    tabId = "orders-tab";
  }

  else if (tabName === "profile") {
    tabId = "profile-tab";
  }

  else if (tabName === "analytics") {
    tabId = "analytics-tab";
  }

  const activeTab = document.getElementById(tabId);

  if (!activeTab) {
    debug("❌ Tab not found:", tabId);
    return;
  }

  activeTab.style.display = "block";
  activeTab.classList.add("active");

  // Activate nav button
  const activeBtn = document.querySelector(
    `[data-tab="${tabName}"]`
  );

  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  // Load tab data
  try {
    if (tabName === "my-ads") {
      await loadMyProducts();
    } else if (tabName === "orders") {
      await loadMyOrders();
    } else if (tabName === "profile") {
      await loadProfileSettings();
    } else if (tabName === "analytics") {
      await loadAnalytics();
    }
  
  } catch (err) {

    debug("❌ switchTab error:", err);

  }
}



// ============================================
// LOAD MY PRODUCTS
// ============================================

async function loadMyProducts() {
  debug("loadMyProducts() called");
  
  if (!currentUser) {
    debug("❌ NO CURRENT USER!");
    return;
  }

  const container = document.getElementById("my-ads-list");
  debug("Container found:", !!container);
  
  if (!container) {
    debug("❌ Container #my-ads-list not found!");
    return;
  }

  try {
    debug("Starting product query...");
    debug("Querying by userId:", currentUser.uid);

    let snapshot = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));

    debug("Query by userId returned:", snapshot.size, "products");

    // Fallback to email query
    if (snapshot.empty) {
      debug("No products found by userId, trying userEmail...");
      snapshot = await getDocs(query(
        collection(db, "products"),
        where("userEmail", "==", currentUser.email)
      ));
      debug("Query by userEmail returned:", snapshot.size, "products");
    }

    const products = snapshot.docs.map(doc => {
      debug("Product doc:", doc.id, doc.data().name);
      return {
        id: doc.id,
        ...doc.data()
      };
    });

    debug("Total products to display:", products.length);

    if (products.length === 0) {
      debug("No products - showing empty state");
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

    debug("Rendering", products.length, "products...");
    
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

    debug("✅ Products rendered successfully!");

  } catch (err) {
    debug("❌ ERROR:", err.message);
    
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;background:#fee2e2;border-radius:12px">
        <p style="color:#991b1b;font-weight:700">❌ Error loading products</p>
        <p style="color:#991b1b;font-size:13px;margin-top:8px">${err.message}</p>
        <button class="btn btn-outline" onclick="loadMyProducts()" style="margin-top:12px">Try Again</button>
      </div>
    `;
  }
}

// ============================================
// BOOST PRODUCT
// ============================================

// ============================================
// BOOST PRODUCT (SEND TO WHATSAPP)
// ============================================

window.boostFromDashboard = async function(productId, productName) {
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
        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', '${productName}', 7, 5000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">7 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 5,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', '${productName}', 14, 8000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">14 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 8,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoostPlan(this, '${productId}', '${productName}', 30, 15000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">30 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 15,000</p>
          </div>
          <input type="radio" name="boost-plan-${productId}">
        </div>
      </div>

      <button class="btn btn-orange" onclick="proceedToPayment()" style="width:100%;padding:14px;font-size:15px;font-weight:800">Pay via WhatsApp 💬</button>
    </div>
  `;

  document.body.appendChild(modal);
};

window.selectBoostPlan = function(el, productId, productName, days, price) {
  document.querySelectorAll(`input[name="boost-plan-${productId}"]`).forEach(r => r.checked = false);
  el.querySelector("input").checked = true;
  window.selectedBoostPlan = { productId, productName, days, price };
};

window.proceedToPayment = async function() {
  if (!window.selectedBoostPlan) {
    alert("❌ Please select a boost plan");
    return;
  }

  const { productId, productName, days, price } = window.selectedBoostPlan;

  try {
    // Save boost request to Firestore
    const boostRequest = {
      productId,
      productName,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      days,
      price,
      status: "pending",  // Admin will change to "approved" or "rejected"
      createdAt: new Date(),
      approvedAt: null
    };

    const docRef = await addDoc(collection(db, "boost_requests"), boostRequest);
    debug("Boost request saved with ID:", docRef.id);

    // Close modal
    const modal = document.getElementById("boost-modal-" + productId);
    if (modal) modal.remove();

    // WhatsApp message
    const whatsappNumber = "256790548910"; // ⚠️ CHANGE THIS TO YOUR NUMBER!
    const whatsappMessage = encodeURIComponent(
      `Hi 👋\n\n` +
      `I want to boost my product:\n\n` +
      `📦 ${productName}\n` +
      `⏱️ ${days} Days\n` +
      `💰 UGX ${price.toLocaleString()}\n\n` +
      `Please confirm payment & boost my ad!\n\n` +
      `Boost Request ID: ${docRef.id}`
    );

    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
    window.open(whatsappUrl, "_blank");

    // Show confirmation message
    alert(
      `✅ Boost request created!\n\n` +
      `📱 WhatsApp will open for payment\n` +
      `💬 Send the message to confirm\n` +
      `⏳ We'll boost your ad within 24 hours after payment\n\n` +
      `Request ID: ${docRef.id}`
    );

    loadMyProducts();

  } catch (err) {
    console.error("Boost request error:", err);
    alert("❌ Error: " + err.message);
  }
};

// ============================================
// EDIT PRODUCT (SINGLE DEFINITION)
// ============================================

window.editProduct = function(productId) {
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
  debug("loadMyOrders() called");
  
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
      container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">📦 No orders yet</p>`;
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
    debug("❌ Load orders error:", err);
    document.getElementById("orders-list").innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}



// ============================================
// LOAD PROFILE SETTINGS (WITH DEBUGGING)
// ============================================

async function loadProfileSettings() {
  debug("loadProfileSettings() called");
  debug("currentUser exists:", !!currentUser);
  debug("currentUser.email:", currentUser?.email);
  
  const container = document.getElementById("profile-settings");
  debug("Container #profile-settings found:", !!container);
  
  if (!container) {
    console.error("❌❌❌ CRITICAL: #profile-settings container NOT FOUND!");
    console.error("Looking for alternatives...");
    
    // Try to find any container in profile-tab
    const profileTab = document.getElementById("profile-tab");
    console.error("profile-tab exists:", !!profileTab);
    
    if (profileTab) {
      console.error("profile-tab HTML:", profileTab.innerHTML);
    }
    
    alert("❌ SETTINGS CONTAINER NOT FOUND\n\nYour dashboard.html is missing the correct structure.\n\nCheck the console for details.");
    return;
  }
  
  try {
    debug("Rendering settings for user:", currentUser.email);
    
    const settingsHTML = `
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


    // Show account type and upgrade button
const userDoc = await getDoc(doc(db, "users", currentUser.uid));
if (userDoc.exists()) {
  const userData = userDoc.data();
  const accountType = userData.accountType || "normal";
  
  document.getElementById("account-type-display").textContent = 
    accountType === "business" ? "💼 Business Account" : "👤 Regular Account";
  
  if (accountType === "normal") {
    document.getElementById("upgrade-btn").style.display = "block";
  } else {
    document.getElementById("business-status").style.display = "block";
  }
}
    
    container.innerHTML = settingsHTML;
    debug("✅ Settings rendered successfully!");
    
  } catch (err) {
    console.error("❌ Error rendering settings:", err);
    container.innerHTML = `<p style="color:red;padding:20px">Error: ${err.message}</p>`;
  }
}

// ============================================
// CHANGE PASSWORD
// ============================================

window.changePassword = function() {
  alert("Password change feature coming soon");
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
};

window.upgradeToBusiness = async function() {

  if (!currentUser) {
    alert("Please login first");
    return;
  }

  try {

    // Save request in Firebase
    await addDoc(collection(db, "business_requests"), {
      userId: currentUser.uid,
      email: currentUser.email,
      status: "pending",
      requestedAt: new Date(),
      subscriptionPlan: "pending-payment"
    });

    // Open your WhatsApp
    const phone = "256790548910"; // YOUR NUMBER
    const msg = encodeURIComponent(
      `Hello Admin, I want to upgrade to a ZiBuy Business Account.\n\nEmail: ${currentUser.email}`
    );

    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");

    alert("✅ Request submitted. Complete payment on WhatsApp.");

  } catch (err) {
    console.error(err);
    alert("Failed to submit request");
  }

};

// ============================================
// ANALYTICS — plan-gated dashboard
// ============================================

async function loadAnalytics() {
  const container = document.getElementById("analytics-container");
  const badge     = document.getElementById("analytics-plan-badge");
  if (!container) return;

  container.innerHTML = `<p style="text-align:center;padding:40px;color:#6b7280">Loading...</p>`;

  try {
    // ── 1. Get user plan ──────────────────────
    const subSnap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "active")
    ));
    let plan = "free";
    if (!subSnap.empty) {
      const sub = subSnap.docs[0].data();
      const end = sub.endDate?.toDate?.();
      plan = (end && new Date() < end) ? (sub.plan || "free") : "free";
    }

    const planLabels = { free:"🆓 Free", bronze:"🥉 Bronze", silver:"🥈 Silver", gold:"🥇 Gold" };
    const planColors = { free:"#6b7280", bronze:"#92400e", silver:"#475569", gold:"#b45309" };
    const planBg     = { free:"#f3f4f6", bronze:"#fef3c7", silver:"#f1f5f9", gold:"#fffbeb" };

    if (badge) {
      badge.textContent   = planLabels[plan] || "🆓 Free";
      badge.style.background = planBg[plan]  || "#f3f4f6";
      badge.style.color      = planColors[plan] || "#6b7280";
    }

    // ── 2. Get user's ads ─────────────────────
    const adsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));
    const ads = adsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeAds  = ads.filter(a => a.status === "active");
    const totalViews = ads.reduce((s, a) => s + (a.views || 0), 0);

    // ── 3. Get user's orders ──────────────────
    const ordersSnap = await getDocs(query(
      collection(db, "orders"),
      where("userEmail", "==", currentUser.email)
    ));
    const orders       = ordersSnap.docs.map(d => d.data());
    const totalOrders  = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

    // ── FREE ──────────────────────────────────
    if (plan === "free") {
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          ${statCard("Active Ads", activeAds.length, "#ff6600")}
          ${statCard("Total Views", totalViews.toLocaleString(), "#6b7280")}
        </div>
        ${upgradePrompt("bronze", "Get views per ad, order tracking & more")}
      `;
      return;
    }

    // ── BRONZE ────────────────────────────────
    if (plan === "bronze") {
      const topAds = [...ads].sort((a, b) => (b.views||0) - (a.views||0)).slice(0, 5);
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          ${statCard("Active Ads",   activeAds.length,          "#ff6600")}
          ${statCard("Total Views",  totalViews.toLocaleString(),"#6b7280")}
          ${statCard("Orders Made",  totalOrders,               "#10b981")}
        </div>

        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">👁️ Views per Ad</h3>
          ${topAds.length === 0 ? "<p style='color:#6b7280;font-size:13px'>No ads yet</p>" :
            topAds.map(a => barRow(a.name, a.views || 0, totalViews || 1, "#ff6600")).join("")}
        </div>

        ${upgradePrompt("silver", "Unlock revenue tracking, category breakdown & 7-day trends")}
      `;
      return;
    }

    // ── SILVER ────────────────────────────────
    if (plan === "silver") {
      const categories = {};
      ads.forEach(a => {
        categories[a.category || "Other"] = (categories[a.category || "Other"] || 0) + (a.views || 0);
      });
      const topCats    = Object.entries(categories).sort((a,b) => b[1]-a[1]).slice(0, 5);
      const maxCatView = Math.max(...topCats.map(c => c[1]), 1);

      const topAds = [...ads].sort((a,b) => (b.views||0)-(a.views||0)).slice(0,5);

      const last7 = orders.filter(o => {
        const d = o.createdAt?.toDate?.();
        return d && (new Date() - d) <= 7*86400000;
      });

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          ${statCard("Active Ads",     activeAds.length,                 "#ff6600")}
          ${statCard("Total Views",    totalViews.toLocaleString(),       "#6b7280")}
          ${statCard("Orders Made",    totalOrders,                      "#10b981")}
          ${statCard("Total Revenue",  "UGX "+totalRevenue.toLocaleString(), "#8b5cf6")}
          ${statCard("Orders (7 days)",last7.length,                     "#f59e0b")}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">👁️ Top Ads by Views</h3>
            ${topAds.length === 0 ? "<p style='color:#6b7280;font-size:13px'>No ads</p>" :
              topAds.map(a => barRow(a.name, a.views||0, totalViews||1, "#ff6600")).join("")}
          </div>
          <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">🗂️ Views by Category</h3>
            ${topCats.length === 0 ? "<p style='color:#6b7280;font-size:13px'>No data</p>" :
              topCats.map(([cat, v]) => barRow(cat, v, maxCatView, "#8b5cf6")).join("")}
          </div>
        </div>

        ${upgradePrompt("gold", "Unlock export to CSV, conversion insights & full performance history")}
      `;
      return;
    }

    // ── GOLD ──────────────────────────────────
    const categories = {};
    ads.forEach(a => {
      categories[a.category || "Other"] = (categories[a.category || "Other"] || 0) + (a.views||0);
    });
    const topCats    = Object.entries(categories).sort((a,b) => b[1]-a[1]).slice(0,5);
    const maxCatView = Math.max(...topCats.map(c => c[1]), 1);
    const topAds     = [...ads].sort((a,b) => (b.views||0)-(a.views||0)).slice(0,10);
    const soldAds    = ads.filter(a => a.status === "sold").length;
    const boostedAds = ads.filter(a => a.isPremium).length;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px">
        ${statCard("Active Ads",     activeAds.length,                  "#ff6600")}
        ${statCard("Total Views",    totalViews.toLocaleString(),        "#6b7280")}
        ${statCard("Orders",         totalOrders,                       "#10b981")}
        ${statCard("Revenue",        "UGX "+totalRevenue.toLocaleString(),"#8b5cf6")}
        ${statCard("Sold Ads",       soldAds,                           "#f59e0b")}
        ${statCard("Boosted Ads",    boostedAds,                        "#b45309")}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">👁️ Top 10 Ads by Views</h3>
          ${topAds.map(a => barRow(a.name, a.views||0, totalViews||1, "#ff6600")).join("") || "<p style='color:#6b7280;font-size:13px'>No ads</p>"}
        </div>
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">🗂️ Views by Category</h3>
          ${topCats.map(([cat, v]) => barRow(cat, v, maxCatView, "#8b5cf6")).join("") || "<p style='color:#6b7280;font-size:13px'>No data</p>"}
        </div>
      </div>

      <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3 style="font-size:14px;font-weight:800;margin:0">📋 Full Ad Performance</h3>
          <button onclick="exportAnalyticsCSV()" style="background:#ff6600;color:white;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">⬇️ Export CSV</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Ad Name</th>
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Category</th>
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Price</th>
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Views</th>
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Status</th>
              <th style="padding:10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Boosted</th>
            </tr>
          </thead>
          <tbody>
            ${ads.map(a => `
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.name || "—"}</td>
                <td style="padding:10px;color:#6b7280">${a.category || "—"}</td>
                <td style="padding:10px;color:#ff6600;font-weight:800">UGX ${Number(a.price||0).toLocaleString()}</td>
                <td style="padding:10px;font-weight:700">${a.views || 0}</td>
                <td style="padding:10px"><span style="padding:3px 8px;border-radius:20px;font-size:11px;font-weight:800;background:${a.status==='active'?'#dcfce7':'#fee2e2'};color:${a.status==='active'?'#166534':'#991b1b'}">${a.status||"active"}</span></td>
                <td style="padding:10px">${a.isPremium ? "⭐ Yes" : "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;

    // Store for CSV export
    window._analyticsAds    = ads;
    window._analyticsOrders = orders;

  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:red;text-align:center;padding:40px">Failed to load analytics</p>`;
  }
}

// ── Helpers ───────────────────────────────────
function statCard(label, value, color) {
  return `
    <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ${color};text-align:center">
      <p style="font-size:22px;font-weight:900;color:${color};margin:0">${value}</p>
      <p style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:4px 0 0">${label}</p>
    </div>`;
}

function barRow(label, value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${label}</span>
        <span style="color:#6b7280;font-weight:700">${value}</span>
      </div>
      <div style="height:6px;background:#f0f0f0;border-radius:20px">
        <div style="height:6px;width:${pct}%;background:${color};border-radius:20px;transition:width .6s"></div>
      </div>
    </div>`;
}

function upgradePrompt(plan, reason) {
  const icons = { bronze:"🥉", silver:"🥈", gold:"🥇" };
  return `
    <div style="background:linear-gradient(135deg,#fff4ee,#fffbeb);border:2px solid #ff6600;border-radius:14px;padding:20px;text-align:center">
      <p style="font-size:24px;margin-bottom:8px">${icons[plan]} Upgrade to ${plan.charAt(0).toUpperCase()+plan.slice(1)}</p>
      <p style="color:#6b7280;font-size:13px;margin-bottom:14px">${reason}</p>
      <button onclick="window.location.href='business-plans.html'" style="background:#ff6600;color:white;border:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">
        ⬆️ Upgrade Now
      </button>
    </div>`;
}

window.exportAnalyticsCSV = function() {
  const ads = window._analyticsAds || [];
  if (ads.length === 0) { alert("No data to export"); return; }

  const rows = [
    ["Ad Name","Category","Price (UGX)","Views","Status","Boosted","Posted Date"],
    ...ads.map(a => [
      `"${(a.name||"").replace(/"/g,'""')}"`,
      a.category || "—",
      a.price || 0,
      a.views || 0,
      a.status || "active",
      a.isPremium ? "Yes" : "No",
      a.createdAt?.toDate?.() ? new Date(a.createdAt.toDate()).toLocaleDateString() : "—"
    ])
  ];

  const csv  = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `zibuy-analytics-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};


window.openMyShop =
async function () {

  if (!auth.currentUser) {

    alert("Please login");

    return;
  }

  try {

    const uid =
      auth.currentUser.uid;

    const shopRef =
      doc(
        db,
        "business_profiles",
        uid
      );

    const snap =
      await getDoc(shopRef);

    /* SHOP EXISTS */
    if (snap.exists()) {

      window.location.href =
        `shop.html?seller=${uid}`;

    }

    /* NO SHOP YET */
    else {

      window.location.href =
        "edit-shop.html";

    }

  } catch (err) {

    console.error(err);

    alert(
      "Failed to open shop"
    );

  }

};


