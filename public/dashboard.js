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
    // Give it 3 seconds before redirecting — secure browsers are slow to resolve auth
    setTimeout(() => {
      if (!currentUser) {
        window.location.href = "index.html";
      }
    }, 3000);
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
    tabEl.style.visibility = "visible";
    tabEl.style.opacity = "1";
  });

  // Remove active nav buttons
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
  });

  const tabMap = {
    "my-ads":    "my-ads-tab",
    "orders":    "orders-tab",
    "profile":   "profile-tab",
    "analytics": "analytics-tab",
    "myprofile": "myprofile-tab",
    "wishlist":  "wishlist-tab"
  };

  const tabId = tabMap[tabName] || "";

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
    } else if (tabName === "myprofile") {
      await loadMyProfile();
    } else if (tabName === "wishlist") {
      await loadWishlist();
    }
  
  } catch (err) {

    debug("❌ switchTab error:", err);

  }
}

// ============================================
// WISHLIST — liked products
// ============================================
async function loadWishlist() {
  const container = document.getElementById("wishlist-list");
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div style="text-align:center;padding:40px;color:#6b7280">Loading...</div>
  `;

  try {
    const snap = await getDocs(query(
      collection(db, "likes"),
      where("userId", "==", currentUser.uid)
    ));

    if (snap.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#6b7280">
          <p style="font-size:48px;margin-bottom:12px">❤️</p>
          <p style="font-size:16px;font-weight:700">No liked products yet</p>
          <p style="font-size:13px;margin-bottom:16px">Tap the heart icon on any product to save it here</p>
          <a href="index.html" class="btn btn-orange" style="display:inline-block;padding:12px 24px;text-decoration:none">
            🛍️ Browse Products
          </a>
        </div>`;
      return;
    }

    const productIds = snap.docs.map(d => d.data().productId).filter(Boolean);

    const products = [];
    for (const pid of productIds) {
      const pSnap = await getDoc(doc(db, "products", pid));
      if (pSnap.exists()) products.push({ id: pSnap.id, ...pSnap.data() });
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#6b7280">
          <p style="font-size:48px;margin-bottom:12px">❤️</p>
          <p>No liked products found (they may have been removed)</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px">
        ${products.map(p => `
          <div onclick="window.location.href='product.html?id=${p.id}'"
            style="background:white;border-radius:12px;overflow:hidden;
            box-shadow:0 2px 8px rgba(0,0,0,0.06);cursor:pointer">
            <img src="${p.images?.[0] || ''}" alt="${p.name}"
              onerror="this.src='https://via.placeholder.com/200?text=No+Image'"
              style="width:100%;height:140px;object-fit:cover">
            <div style="padding:10px">
              <p style="margin:0 0 4px;font-weight:700;font-size:13px;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${p.name}
              </p>
              <p style="margin:0;color:#ff6600;font-weight:800;font-size:14px">
                UGX ${Number(p.price || 0).toLocaleString()}
              </p>
            </div>
          </div>
        `).join("")}
      </div>
    `;

  } catch (err) {
    console.error("loadWishlist error:", err);
    container.innerHTML = `<p style="color:red;padding:20px">Failed to load wishlist</p>`;
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

    window._userAds = products;

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

              ${p.category === "seeking-work"
                ? `<button class="btn btn-sm"
                    style="background:#1e40af;color:white;border:none;cursor:pointer;border-radius:8px"
                    onclick="boostCV('${p.id}','${p.name.replace(/'/g,"\\'")}')">
                    📌 Boost CV
                  </button>`
                : p.isPremium
                  ? `<button class="btn btn-sm"
                      style="background:#10b981;color:white;border:none;cursor:default;border-radius:8px">
                      ✅ Featured
                    </button>`
                  : `<button class="btn btn-sm btn-featured"
                      onclick="boostFromDashboard('${p.id}','${p.name.replace(/'/g,"\\'")}')">
                      ⭐ Boost
                    </button>`
              }

              <button class="btn btn-sm btn-delete" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
            </div>
        </div>
      </div>
    `).join("");


    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "14px";
    debug("✅ Products rendered successfully!");

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
  const paymentRef = `BOOST-${productId.slice(0, 8).toUpperCase()}`;

  // Close plan selection modal
  const modal = document.getElementById("boost-modal-" + productId);
  if (modal) modal.remove();

  // Show payment instructions modal
  const existing = document.getElementById("dash-boost-payment-modal");
  if (existing) existing.remove();

  const payModal = document.createElement("div");
  payModal.id = "dash-boost-payment-modal";
  payModal.className = "modal open";
  payModal.innerHTML = `
    <div class="modal-box" style="max-width:480px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <h2>📱 Pay to Boost Ad</h2>
        <button class="modal-close" onclick="document.getElementById('dash-boost-payment-modal').remove()">×</button>
      </div>

      <div style="text-align:center;background:#fff4ee;border-radius:12px;padding:14px;margin-bottom:16px">
        <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Boosting: <strong>${productName}</strong></p>
        <p style="font-size:24px;font-weight:900;color:#ff6600;margin:0">${days} Days — UGX ${Number(price).toLocaleString()}</p>
        <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Reference: <strong style="color:#ff6600">${paymentRef}</strong></p>
      </div>

      <!-- MTN -->
      <div style="border:2px solid #ffcc00;border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ffcc00;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:#111">MTN</div>
          <span style="font-weight:800;font-size:14px">MTN Mobile Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ff6600">*165#</strong> on your MTN line</li>
          <li>Select <strong>Pay With Momo</strong></li>
          <li>Enter Merchant Code: <strong style="color:#ff6600;font-size:15px">27868095</strong></li>
          <li>Amount: <strong style="color:#ff6600">UGX ${Number(price).toLocaleString()}</strong></li>
          
          <li>Enter PIN to confirm</li>
        </ol>
      </div>

      <!-- Airtel -->
      <div style="border:2px solid #ef4444;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ef4444;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:white">AIRTEL</div>
          <span style="font-weight:800;font-size:14px">Airtel Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ef4444">*185#</strong> on your Airtel line</li>
          <li>Select <strong>Send Money</strong></li>
          <li>Send to: <strong style="color:#ef4444;font-size:15px">+256575996624</strong></li>
          <li>Amount: <strong style="color:#ef4444">UGX ${Number(price).toLocaleString()}</strong></li>
          
          <li>Enter PIN to confirm</li>
        </ol>
      </div>

      <!-- Transaction reference input -->
      <div style="margin-bottom:14px">
        <label style="font-size:13px;font-weight:800;color:#111827;display:block;margin-bottom:8px">
          📋 Enter your transaction ID after paying
        </label>
        <input type="text" id="dash-boost-txn-ref"
          placeholder="e.g. 1234567890 or REF123456"
          style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#ff6600'"
          onblur="this.style.borderColor='#e5e7eb'"
        >
        <p style="font-size:12px;color:#6b7280;margin-top:6px">
          The confirmation ID you received on your phone after paying
        </p>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#92400e">
        ⏱️ After entering your transaction ID, click below to notify admin. Boost activated within <strong>1 hour</strong>.
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <button id="dash-boost-submit-btn" onclick="submitDashboardBoost('${productId}', '${productName}', ${days}, ${price}, '${paymentRef}', this)"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          📲 Send Reference to Admin WhatsApp
        </button>
        <button onclick="document.getElementById('dash-boost-payment-modal').remove()"
          style="background:#f3f4f6;color:#6b7280;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;width:100%">
          I'll pay later
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(payModal);
};

window.submitDashboardBoost = async function(productId, productName, days, price, paymentRef, btnEl) {
  const txnInput = document.getElementById("dash-boost-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";

  if (!txnRef) {
    if (txnInput) {
      txnInput.style.borderColor = "#ef4444";
      txnInput.placeholder = "⚠️ Please enter your transaction ID first";
      txnInput.focus();
    }
    return;
  }

  // ── Plan boost limit check ──────────────────
  const { checkCanBoost } = await import("./plan-limits.js");
  const boostCheck = await checkCanBoost();
  if (!boostCheck.allowed) {
    alert(`⚠️ ${boostCheck.reason}`);
    return;
  }

  const btn = btnEl || document.getElementById("dash-boost-submit-btn");
  if (btn) {
    btn.textContent = "Saving...";
    btn.disabled    = true;
  }

  try {
    const docRef = await addDoc(collection(db, "boost_requests"), {
      productId,
      productName,
      userId:         currentUser.uid,
      userEmail:      currentUser.email,
      days,
      price,
      paymentRef,
      transactionRef: txnRef,
      status:         "pending",
      requestedAt:    new Date()
    });

    document.getElementById("dash-boost-payment-modal")?.remove();

    // Open admin WhatsApp with full details
    const waMsg = encodeURIComponent(
      `Hello ZiBuy Admin 👋\n\n` +
      `I have paid to boost my ad.\n\n` +
      `📋 *Boost Details:*\n` +
      `• Ad: *${productName}*\n` +
      `• Duration: *${days} Days*\n` +
      `• Amount: *UGX ${Number(price).toLocaleString()}*\n` +
      `• Reference Code: *${paymentRef}*\n` +
      `• Transaction ID: *${txnRef}*\n` +
      `• Email: *${currentUser.email}*\n\n` +
      `Please verify and activate my boost. Thank you! 🙏`
    );

    window.open(`https://wa.me/256790548910?text=${waMsg}`, "_blank");

    // Success screen
    const successModal = document.createElement("div");
    successModal.className = "modal open";
    successModal.innerHTML = `
      <div class="modal-box" style="max-width:400px;text-align:center">
        <p style="font-size:52px;margin-bottom:12px">✅</p>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Reference Sent!</h2>
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px;text-align:left">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
            <span style="color:#6b7280">Reference Code</span>
            <strong style="color:#ff6600">${paymentRef}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:#6b7280">Transaction ID</span>
            <strong style="color:#ff6600">${txnRef}</strong>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-bottom:20px;line-height:1.6">
          Admin will verify and activate your boost within <strong>1 hour</strong>. 
          Your ad will show a ⭐ badge once active.
        </p>
        <button onclick="this.closest('.modal').remove();loadMyProducts()"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          Done →
        </button>
      </div>
    `;
    document.body.appendChild(successModal);

  } catch (err) {
    console.error("Boost submit error:", err);
    alert("❌ Error: " + err.message);
    btn.textContent = "📲 Send Reference to Admin WhatsApp";
    btn.disabled    = false;
  }
};



// ============================================
// CV BOOST — pin seeking-work ad to top
// ============================================
window.boostCV = function(productId, productName) {
  if (!currentUser) { alert("Please login first"); return; }

  const payRef = `CV-${productId.slice(0,8).toUpperCase()}`;

  const modal = document.createElement("div");
  modal.className = "modal open";
  modal.id = "cv-boost-modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <h2>📌 Boost Your CV</h2>
        <button class="modal-close" onclick="document.getElementById('cv-boost-modal').remove()">×</button>
      </div>

      <p style="color:#6b7280;font-size:14px;margin-bottom:16px;line-height:1.6">
        Pin <strong>${productName}</strong> to the top of the
        Seeking Work section — employers see you first!
      </p>

      <!-- Plans -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        <div class="boost-option" onclick="selectCVPlan(this,7,5000)">
          <div>
            <p style="margin:0;font-weight:800">7 Days — UGX 5,000</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280">📌 Pinned at top for 7 days</p>
          </div>
          <input type="radio" name="cv-plan">
        </div>
        <div class="boost-option" onclick="selectCVPlan(this,14,8000)">
          <div>
            <p style="margin:0;font-weight:800">14 Days — UGX 8,000</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280">📌 Pinned at top for 14 days</p>
          </div>
          <input type="radio" name="cv-plan">
        </div>
        <div class="boost-option" onclick="selectCVPlan(this,30,15000)">
          <div>
            <p style="margin:0;font-weight:800">30 Days — UGX 15,000</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280">📌 Pinned at top for 30 days</p>
          </div>
          <input type="radio" name="cv-plan">
        </div>
      </div>

      <!-- Payment -->
      <div id="cv-pay-details" style="display:none;margin-bottom:14px">
        <div style="background:#fff9c4;border:1.5px solid #fde047;border-radius:10px;
          padding:12px;margin-bottom:8px;font-size:13px">
          <strong>MTN:</strong> Dial *165# → Pay With Momo →
          Merchant: <strong>27868095</strong> →
          Amount: <strong id="cv-amount-mtn">—</strong>
        </div>
        <div style="background:#fee2e2;border:1.5px solid #fca5a5;border-radius:10px;
          padding:12px;margin-bottom:12px;font-size:13px">
          <strong>Airtel:</strong> Send to <strong>+256575996624</strong> →
          Amount: <strong id="cv-amount-airtel">—</strong>
        </div>
        <input type="text" id="cv-txn-ref"
          placeholder="Enter transaction ID after paying"
          style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;
          font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#1e40af'" onblur="this.style.borderColor='#e5e7eb'">
      </div>

      <button onclick="submitCVBoost('${productId}','${productName}','${payRef}')"
        style="width:100%;background:#1e40af;color:white;border:none;padding:14px;
        border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        📌 Boost My CV
      </button>
    </div>
  `;
  document.body.appendChild(modal);
};

window._cvPlan = null;

window.selectCVPlan = function(el, days, price) {
  document.querySelectorAll("input[name='cv-plan']").forEach(r => r.checked = false);
  el.querySelector("input").checked = true;
  window._cvPlan = { days, price };

  const amount = "UGX " + price.toLocaleString();
  document.getElementById("cv-amount-mtn").textContent    = amount;
  document.getElementById("cv-amount-airtel").textContent = amount;
  document.getElementById("cv-pay-details").style.display = "block";
};

window.submitCVBoost = async function(productId, productName, payRef) {
  if (!window._cvPlan) { alert("Please select a plan first"); return; }

  const txnRef = document.getElementById("cv-txn-ref").value.trim();
  if (!txnRef) {
    document.getElementById("cv-txn-ref").style.borderColor = "#ef4444";
    document.getElementById("cv-txn-ref").focus();
    return;
  }

  const { days, price } = window._cvPlan;
  const btn = event.target;
  btn.textContent = "Submitting...";
  btn.disabled    = true;

  try {
    await addDoc(collection(db, "cv_boosts"), {
      productId,
      productName,
      userId:    currentUser.uid,
      userEmail: currentUser.email,
      days,
      price,
      payRef,
      txnRef,
      status:    "pending",
      isTop:     false,
      createdAt: new Date()
    });

    document.getElementById("cv-boost-modal").remove();

    // WhatsApp admin
    const waMsg = encodeURIComponent(
      `Hello ZiBuy Admin 👋\n\n` +
      `*CV Boost Request:*\n\n` +
      `📄 *CV/Ad:* ${productName}\n` +
      `⏱️ *Duration:* ${days} days\n` +
      `💰 *Amount:* UGX ${price.toLocaleString()}\n` +
      `🔖 *Reference:* ${payRef}\n` +
      `📋 *Transaction ID:* ${txnRef}\n` +
      `📧 *Email:* ${currentUser.email}\n\n` +
      `Please verify and pin this CV to the top. Thank you!`
    );
    window.open(`https://wa.me/256790548910?text=${waMsg}`, "_blank");

    // Success toast
    const toast = document.createElement("div");
    toast.className   = "toast success";
    toast.textContent = "✅ CV boost request sent! Activates within 1 hour.";
    document.getElementById("toast-container")?.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);

  } catch(err) {
    console.error(err);
    alert("Failed: " + err.message);
    btn.textContent = "📌 Boost My CV";
    btn.disabled    = false;
  }
};

// ============================================
// EDIT PRODUCT (SINGLE DEFINITION)
// ============================================

let editingProductId = null;

window.editProduct = function(productId) {
  const product = (window._userAds || []).find(p => p.id === productId);
  if (!product) return;

  editingProductId = productId;

  document.getElementById("edit-name").value      = product.name        || "";
  document.getElementById("edit-price").value     = product.price       || "";
  document.getElementById("edit-desc").value      = product.description || "";
  document.getElementById("edit-location").value  = product.location    || "";
  document.getElementById("edit-phone").value     = product.seller?.phone || "";

  const modal = document.getElementById("edit-modal");
  modal.style.display = "flex";

  const preview = document.getElementById("edit-image-preview");

preview.innerHTML = product.images.map(img => `
  <img src="${img}"
       style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin:4px">
`).join("");

};

window.closeEditModal = function() {
  document.getElementById("edit-modal").style.display = "none";
  editingProductId = null;
};

window.saveEdit = async function() {
  if (!editingProductId) return;

  const name     = document.getElementById("edit-name").value.trim();
  const price    = Number(document.getElementById("edit-price").value);
  const desc     = document.getElementById("edit-desc").value.trim();
  const location = document.getElementById("edit-location").value;
  const phone    = document.getElementById("edit-phone").value.trim();

  if (!name || !price) {
    alert("Name and price are required");
    return;
  }

  const btn = document.getElementById("edit-save-btn");
  btn.textContent = "Saving...";
  btn.disabled    = true;

  try {

    const imageFiles =
  document.getElementById("edit-images").files;

let imageUrls = [];

if (imageFiles.length > 0) {

  const {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
  } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"
  );

  const storage = getStorage();

  for (const file of imageFiles) {

    const storageRef = ref(
      storage,
      `products/${Date.now()}-${file.name}`
    );

    await uploadBytes(storageRef, file);

    const url =
      await getDownloadURL(storageRef);

    imageUrls.push(url);
  }
}

    await updateDoc(doc(db, "products", editingProductId), {
      name,
      price,
      description: desc,
      location,
      "seller.phone": phone,
      updatedAt: new Date()
    });

    closeEditModal();
    alert("✅ Ad updated!");
    loadMyProducts(); // refresh the list
  } catch (err) {
    console.error(err);
    alert("❌ Failed to update: " + err.message);
  } finally {
    btn.textContent = "Save Changes";
    btn.disabled    = false;
  }
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
    
    // Fetch user plan first
    const userDoc  = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const plan     = userData.plan || "free";

    const planLabels = {
      free:   "🆓 Free Plan",
      bronze: "🥉 Bronze Plan",
      silver: "🥈 Silver Plan",
      gold:   "🥇 Gold Plan"
    };

    const planColors = {
      free:   "#6b7280",
      bronze: "#92400e",
      silver: "#475569",
      gold:   "#b45309"
    };

    const planBgs = {
      free:   "#f3f4f6",
      bronze: "#fef3c7",
      silver: "#f1f5f9",
      gold:   "#fffbeb"
    };

    // Build and set HTML all at once — plan info included inline
    container.innerHTML = `
      <div class="settings-section">
        <h3>👤 Account Information</h3>
        <div style="padding:14px;background:#f3f4f6;border-radius:10px;margin-bottom:12px">
          <p style="margin:6px 0"><strong>Email:</strong> ${currentUser.email}</p>
          <p style="margin:6px 0"><strong>User ID:</strong> <span style="font-size:12px;color:#6b7280">${currentUser.uid}</span></p>
          <p style="margin:6px 0"><strong>Member Since:</strong> ${new Date(currentUser.metadata?.creationTime).toLocaleDateString()}</p>
        </div>
      </div>

      <div class="settings-section">
        <h3>💼 Current Plan</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:${planBgs[plan]};border-radius:10px;margin-bottom:12px">
          <span style="font-weight:800;font-size:15px;color:${planColors[plan]}">${planLabels[plan]}</span>
          ${plan === "free"
            ? `<button onclick="window.location.href='business-plans.html'"
                style="background:#ff6600;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit">
                ⬆️ Upgrade
               </button>`
            : `<span style="background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:800">✅ Active</span>`
          }
        </div>
        ${plan !== "free"
          ? `<button onclick="window.location.href='business-plans.html'"
              style="background:#f3f4f6;color:#374151;border:none;padding:10px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;width:100%">
              🔄 Change Plan
             </button>`
          : ""
        }
      </div>

      <div class="settings-section">
        <h3>🔐 Security</h3>
        <button class="btn btn-outline" onclick="changePassword()" style="width:100%;margin-bottom:8px">Change Password</button>
        <button class="btn btn-outline" style="width:100%" onclick="logout()">Logout</button>
      </div>

      <div class="settings-section" style="border:1px solid #fee2e2">
        <h3 style="color:#991b1b">⚠️ Danger Zone</h3>
        <button class="btn" style="background:#ef4444;color:white;width:100%" onclick="deleteAccount()">Delete My Account</button>
      </div>
    `;

    debug("✅ Settings rendered successfully!");
    
  } catch (err) {
    console.error("❌ Error rendering settings:", err);
    container.innerHTML = `<p style="color:red;padding:20px">Error: ${err.message}</p>`;
  }
}


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

window.deleteAccount = async function() {
  const confirm1 = confirm("Delete your ZiBuy account permanently?");
  if (!confirm1) return;

  const confirm2 = confirm("⚠️ ALL your ads, orders and data will be deleted. This CANNOT be undone. Continue?");
  if (!confirm2) return;

  try {
    const { deleteUser, reauthenticateWithCredential, EmailAuthProvider }
      = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    // Re-authenticate first (Firebase requires this for deletion)
    const password = prompt("Enter your password to confirm deletion:");
    if (!password) return;

    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    const uid   = currentUser.uid;
    const email = currentUser.email;

    // Delete user's ads
    const adsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", uid)
    ));
    for (const d of adsSnap.docs) {
      await deleteDoc(doc(db, "products", d.id));
    }

    // Delete user's boost requests
    const boostSnap = await getDocs(query(
      collection(db, "boost_requests"),
      where("userId", "==", uid)
    ));
    for (const d of boostSnap.docs) {
      await deleteDoc(doc(db, "boost_requests", d.id));
    }

    // Delete user's business account
    const subSnap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", uid)
    ));
    for (const d of subSnap.docs) {
      await deleteDoc(doc(db, "business_accounts", d.id));
    }

    // Delete user doc
    await deleteDoc(doc(db, "users", uid)).catch(() => {});

    // Delete Firebase Auth account
    await deleteUser(currentUser);

    alert("✅ Your account has been deleted.");
    window.location.href = "index.html";

  } catch (err) {
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      alert("❌ Wrong password. Account not deleted.");
    } else if (err.code === "auth/requires-recent-login") {
      alert("⚠️ Please log out and log back in, then try again.");
    } else {
      alert("❌ Failed: " + err.message);
    }
  }
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

      // ── Plan gate: Business Profile requires Bronze+ ──
      const { getCurrentPlanId } = await import("./plan-limits.js");
      const planId = await getCurrentPlanId(uid);

      if (planId === "free") {
        if (confirm("📋 A Business Profile Page is available on Bronze plan and above.\n\nUpgrade now to create your shop page?")) {
          window.location.href = "business-plans.html";
        }
        return;
      }

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


// ============================================
// MY PROFILE TAB
// ============================================

async function loadMyProfile() {
  const container = document.getElementById("myprofile-container");
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div style="text-align:center;padding:40px;color:#6b7280">
      <div style="width:40px;height:40px;border:3px solid #ff6600;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
      <p>Loading your profile...</p>
    </div>
  `;

  try {
    // ── 1. Get user doc ──────────────────────
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    // ── 2. Get user's products ───────────────
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));
    const products   = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeAds  = products.filter(p => p.status === "active").length;
    const totalViews = products.reduce((s, p) => s + (p.views || 0), 0);
    const totalLikes = products.reduce((s, p) => s + (p.likes || 0), 0);

    // ── 3. Get user's reviews ────────────────
    const reviewsSnap = await getDocs(query(
      collection(db, "reviews"),
      where("sellerId", "==", currentUser.uid)
    ));
    const reviews   = reviewsSnap.docs.map(d => d.data());
    const avgRating = reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

    // ── 4. Get plan ──────────────────────────
    const subSnap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "active")
    ));
    let planName = "🆓 Free Plan";
    let planExpiry = null;
    if (!subSnap.empty) {
      const sub = subSnap.docs[0].data();
      const end = sub.endDate?.toDate?.();
      if (end && new Date() < end) {
        const labels = { bronze:"🥉 Bronze", silver:"🥈 Silver", gold:"🥇 Gold" };
        planName   = labels[sub.plan] || "🆓 Free";
        planExpiry = end;
      }
    }

    // ── 5. Get verification status ───────────
    const verifSnap = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", currentUser.uid)
    ));
    const isVerified = !verifSnap.empty &&
      verifSnap.docs[0].data().status === "approved";

    // ── 6. Profile data ──────────────────────
    const displayName = userData.displayName ||
      currentUser.email.split("@")[0];
    const phone       = userData.phone    || "—";
    const location    = userData.location || "Uganda";
    const bio         = userData.bio      || "No bio yet.";
    const joinedDate  = currentUser.metadata?.creationTime
      ? new Date(currentUser.metadata.creationTime).toLocaleDateString("en-UG", { day:"numeric", month:"long", year:"numeric" })
      : "—";
    const initial     = displayName[0].toUpperCase();

    // ── 7. Store for edit form ───────────────
    window._myProfileData = { displayName, phone, location, bio };

    // ── 8. Render ────────────────────────────
    container.innerHTML = `

      <!-- Avatar + Name -->
      <div style="background:white;border-radius:20px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.07);margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#ff6600,#ff9900);color:white;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${initial}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <h2 style="margin:0;font-size:22px;font-weight:800;color:#111827">${displayName}</h2>
            ${isVerified ? `<span style="background:#10b981;color:white;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800">✅ Verified</span>` : ""}
            <span style="background:#fff4ee;color:#ff6600;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800">${planName}</span>
          </div>
          <p style="margin:0 0 4px;color:#6b7280;font-size:14px">📍 ${location}</p>
          <p style="margin:0 0 4px;color:#6b7280;font-size:14px">📱 ${phone}</p>
          <p style="margin:0;color:#6b7280;font-size:13px">🗓️ Member since ${joinedDate}</p>
        </div>
        <a href="user-profile.html?id=${currentUser.uid}"
          style="background:#f3f4f6;color:#374151;border:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;white-space:nowrap">
          👁️ Public View
        </a>
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">
        ${profileStat("📦", "Total Ads", products.length, "#ff6600")}
        ${profileStat("✅", "Active Ads", activeAds, "#10b981")}
        ${profileStat("👁️", "Total Views", totalViews.toLocaleString(), "#6b7280")}
        ${profileStat("❤️", "Total Likes", totalLikes.toLocaleString(), "#ef4444")}
        ${profileStat("⭐", "Avg Rating", avgRating, "#f59e0b")}
        ${profileStat("💬", "Reviews", reviews.length, "#8b5cf6")}
      </div>

      <!-- Plan & Expiry -->
      <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.07);margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 14px;color:#111827">💼 Plan Details</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <p style="margin:0;font-size:16px;font-weight:800;color:#ff6600">${planName}</p>
            ${planExpiry
              ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280">Expires: ${planExpiry.toLocaleDateString("en-UG",{day:"numeric",month:"long",year:"numeric"})}</p>`
              : `<p style="margin:4px 0 0;font-size:13px;color:#6b7280">No expiry — free forever</p>`
            }
          </div>
          <button onclick="window.location.href='business-plans.html'"
            style="background:#ff6600;color:white;border:none;padding:10px 18px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit">
            ⬆️ Upgrade
          </button>
        </div>
      </div>

      <!-- Bio -->
      <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.07);margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 10px;color:#111827">📝 About Me</h3>
        <p id="mp-bio-display" style="color:#374151;font-size:14px;line-height:1.7;margin:0">${bio}</p>
      </div>

      <!-- My Ads preview -->
      <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.07);margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3 style="font-size:15px;font-weight:800;margin:0;color:#111827">📦 My Ads</h3>
          <button onclick="switchTab('my-ads',null)"
            style="background:#f3f4f6;color:#374151;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
            View All →
          </button>
        </div>
        ${products.length === 0
          ? `<p style="color:#6b7280;font-size:14px">No ads posted yet. <a href="post-ad.html" style="color:#ff6600;font-weight:700">Post your first ad →</a></p>`
          : `<div style="display:flex;flex-direction:column;gap:10px">
              ${products.slice(0, 3).map(p => `
                <div onclick="window.location.href='product.html?id=${p.id}'"
                  style="display:flex;gap:12px;align-items:center;padding:10px;background:#f9fafb;border-radius:10px;cursor:pointer;transition:.2s"
                  onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'">
                  <img src="${p.images?.[0] || ''}"
                    onerror="this.style.display='none'"
                    style="width:52px;height:52px;object-fit:cover;border-radius:8px;background:#e5e7eb;flex-shrink:0">
                  <div style="flex:1;min-width:0">
                    <p style="margin:0;font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</p>
                    <p style="margin:3px 0 0;color:#ff6600;font-weight:800;font-size:13px">UGX ${Number(p.price).toLocaleString()}</p>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <p style="margin:0;font-size:12px;color:#6b7280">👁️ ${p.views || 0} views</p>
                    <p style="margin:3px 0 0;font-size:12px;color:#ef4444">❤️ ${p.likes || 0} likes</p>
                  </div>
                </div>
              `).join("")}
            </div>`
        }
      </div>

      <!-- Recent Reviews -->
      <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.07)">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 14px;color:#111827">⭐ Reviews I've Received</h3>
        ${reviews.length === 0
          ? `<p style="color:#6b7280;font-size:14px">No reviews yet.</p>`
          : reviews.slice(0, 3).map(r => `
              <div style="padding:12px;background:#f9fafb;border-radius:10px;border-left:4px solid #ff6600;margin-bottom:10px">
                <p style="margin:0;font-size:14px">${"⭐".repeat(r.rating)} <strong>${r.rating}/5</strong></p>
                <p style="margin:6px 0;font-size:13px;color:#374151">${r.text || r.reviewText || ""}</p>
                <p style="margin:0;font-size:11px;color:#adb5bd">${r.reviewerEmail} · ${r.createdAt ? new Date(r.createdAt.toDate()).toLocaleDateString() : ""}</p>
              </div>
            `).join("")
        }
      </div>
    `;

  } catch (err) {
    console.error("loadMyProfile error:", err);
    container.innerHTML = `<p style="color:red;padding:20px">Failed to load profile: ${err.message}</p>`;
  }
}

function profileStat(icon, label, value, color) {
  return `
    <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center;border-top:3px solid ${color}">
      <p style="font-size:22px;margin:0 0 4px">${icon}</p>
      <p style="font-size:20px;font-weight:900;color:${color};margin:0">${value}</p>
      <p style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:4px 0 0">${label}</p>
    </div>`;
}

// ── Edit My Profile ───────────────────────────

window.openEditMyProfile = function() {
  const d = window._myProfileData || {};
  document.getElementById("mp-name").value     = d.displayName || "";
  document.getElementById("mp-phone").value    = d.phone       || "";
  document.getElementById("mp-location").value = d.location    || "";
  document.getElementById("mp-bio").value      = d.bio         || "";
  document.getElementById("edit-myprofile-modal").style.display = "flex";
};

window.closeEditMyProfile = function() {
  document.getElementById("edit-myprofile-modal").style.display = "none";
};

window.saveMyProfile = async function() {
  const name     = document.getElementById("mp-name").value.trim();
  const phone    = document.getElementById("mp-phone").value.trim();
  const location = document.getElementById("mp-location").value;
  const bio      = document.getElementById("mp-bio").value.trim();

  if (!name) {
    document.getElementById("mp-name").style.borderColor = "#ef4444";
    document.getElementById("mp-name").focus();
    return;
  }

  const btn = document.getElementById("mp-save-btn");
  btn.textContent = "Saving...";
  btn.disabled    = true;

  try {
    // Update user doc
    await updateDoc(doc(db, "users", currentUser.uid), {
      displayName: name,
      phone,
      location,
      bio,
      updatedAt: new Date()
    });

    // Update seller info on all products
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));
    await Promise.all(productsSnap.docs.map(d =>
      updateDoc(doc(db, "products", d.id), {
        "seller.name":     name,
        "seller.phone":    phone,
        "seller.location": location,
        updatedAt: new Date()
      })
    ));

    closeEditMyProfile();

    // Refresh the profile tab
    await loadMyProfile();

    // Toast
    const toast = document.createElement("div");
    toast.className   = "toast success";
    toast.textContent = "✅ Profile updated!";
    document.getElementById("toast-container")?.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (err) {
    console.error("saveMyProfile error:", err);
    alert("❌ Failed: " + err.message);
  } finally {
    btn.textContent = "💾 Save Changes";
    btn.disabled    = false;
  }
};

