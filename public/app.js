 // ============================================
// ZiBuy — Main App Logic
// ============================================

import { db, auth, collection, getDocs, addDoc, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFeaturedAds } from "./premium-ads.js";
import "./auth.js";
import {
  deleteDoc,
  doc
} from "./firebase.js";

import {
  getRankedProducts,
  getUserPlan,
  PLAN_SCORE
} from "./ranking-service.js";

// =============================
// GLOBAL STATE (ZiBuy SAFE FIX)
// =============================
let allProducts = [];
let filteredProducts = [];
// User + UI state
let currentUser = null;
let searchQuery = "";
let currentCategory = "all";

// Filter state
let filterState = {
  priceMin: 0,
  priceMax: 99999999,
  location: "",
  dateRange: "all",
  sortBy: "newest"
};

// Keep global sync in real-time
window.allProducts = allProducts;

// ============================================
// DOM READY CHECK
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function initApp() {
  console.log("App initialized");
  setupAuthStateListener();
  loadProducts();
}

// ============================================
// ============================================
// AUTH STATE LISTENER
// ============================================

function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

    // Show boost requests button only for admin
    const adminBoostBtn = document.getElementById("admin-boost-btn");
    if (adminBoostBtn) {
      if (user && user.email === ADMIN_EMAIL) {
        adminBoostBtn.style.display = "block";
      } else {
        adminBoostBtn.style.display = "none";
      }
    }

    // Safely update all DOM elements
    const elements = {
      "post-ad-btn": user ? "block" : "none",
     "dashboard-btn": user ? "block" : "none",
     "upgrade-btn":   user ? "block" : "none", 
      "messages-btn": user ? "block" : "none",
      "notifications-btn": user ? "block" : "none"
    };

    Object.keys(elements).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = elements[id];
      }
    });

    // Update account button
    const accountBtn = document.getElementById("account-btn");
    if (accountBtn) {
      if (user) {
        accountBtn.textContent = "🚪 Logout";
        accountBtn.onclick = () => logoutCustomer();
      } else {
        accountBtn.textContent = "Account";
        accountBtn.onclick = () => openAuthModal();
      }
    }

    // Update cart button visibility
    const cartBtn = document.querySelector(".cart-btn-wrap");
    if (cartBtn && user) {
      cartBtn.style.display = "flex";
    }
  });
}

// ============================================
// LOGOUT
// ============================================

window.logoutCustomer = async function() {
  try {
    await auth.signOut();
    localStorage.removeItem("zibuy-cart");
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
};
// ============================================
// LOAD PRODUCTS FROM FIRESTORE
// ============================================
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    const products = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const product = {
          id: docSnap.id,
          ...docSnap.data()
        };

// ── AUTO EXPIRE ADS ─────────────────

if (product.expiresAt) {

  const expiryDate =
    product.expiresAt.toDate
      ? product.expiresAt.toDate()
      : new Date(product.expiresAt);

  if (expiryDate < new Date()) {

    product.status = "expired";

  }

}

        if (product.userId) {

// ── SHOP SUBSCRIPTION ─────────────────
try {

  const subSnap = await getDocs(
    query(
      collection(db, "business_subscriptions"),
      where("userId", "==", product.userId),
      where("active", "==", true)
    )
  );

  if (!subSnap.empty) {

    const sub = subSnap.docs[0].data();

    product.shopPlan =
      sub.plan || "free";

  } else {

    product.shopPlan = "free";

  }

} catch (err) {

  console.error("Plan check error:", err);

  product.shopPlan = "free";

}

          try {
            const verificationSnap = await getDocs(
              query(
                collection(db, "seller_verifications"),
                where("userId", "==", product.userId),
                where("status", "==", "approved")
              )
            );

            product.seller = product.seller || {};
            product.seller.isVerified = !verificationSnap.empty;
          } catch (err) {
            console.error("Verification check error:", err);
            product.seller = product.seller || {};
            product.seller.isVerified = false;
          }
        } else {
          product.seller = product.seller || {};
          product.seller.isVerified = false;
        }

        /* =========================
   PRODUCT RANKING SCORE
========================= */

const plan =
  await getUserPlan(product.userId);

const planScore =
  PLAN_SCORE[plan] || 1;

/* BOOST SCORE */

let boostScore = 0;

if (product.isPremium === true) {
  boostScore = 5000;
}

/* VERIFIED BONUS */

let verifiedScore = 0;

if (product.seller.isVerified) {
  verifiedScore = 500;
}

/* NEWER ADS BONUS */

const created =
  product.createdAt?.toDate?.()
  || new Date();

const ageHours =
  (new Date() - created) / 36e5;

const freshnessScore =
  Math.max(0, 100 - ageHours);

/* FINAL SCORE */

product.rankScore =
  (planScore * 1000) +
  boostScore +
  verifiedScore +
  freshnessScore;

return product;
      })
    );

 // Store all products globally for use in other functions
allProducts = products.sort((a, b) => b.rankScore - a.rankScore);

window.allProducts = allProducts;

// keep global sync (CRITICAL FIX)
window.allProducts = allProducts;

filteredProducts = [...allProducts];

loadFeaturedProducts();
renderProducts();

} catch (err) {
  console.error(err);


}
}
// ============================================
// LOAD FEATURED PRODUCTS
// ============================================

async function loadFeaturedProducts() {
  try {
    const featured = await getFeaturedAds();
    const container = document.getElementById("products");

    if (!container || featured.length === 0) return;

    const featuredHtml = `
      <div style="grid-column:1/-1;background:linear-gradient(135deg, #fff4ee, #fffbeb);border:2px solid #ff6600;border-radius:14px;padding:20px;margin-bottom:20px">
        <h2 style="margin:0 0 16px;color:#ff6600;font-size:16px;font-weight:800">⭐ FEATURED ADS</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px">
          ${featured.slice(0, 6).map(p => {
            // Get product details
            const product = allProducts.find(ap => ap.id === p.productId);
            if (!product) return "";

            const phone = (product.seller?.phone || "").replace(/\D/g, "");
            const hasPhone = phone.length > 0;

            return `
              <div class="product-card" style="position:relative">
                <div class="product-image-box">
                  <img src="${product.images?.[0] || ''}" alt="${product.name}">
                  <span class="premium-badge">⭐ FEATURED</span>
                </div>
                <div class="product-info">
                  <p class="product-cat">${product.category}</p>
                  <h3 class="product-title">${product.name}</h3>
                  <p class="product-price">UGX ${Number(product.price).toLocaleString()}</p>
                  <div class="card-footer">
                    ${hasPhone ? `
                      <button class="cart-btn" onclick="messageWhatsApp('${phone}', '${product.name}', ${product.price})" style="font-size:11px">💬 WhatsApp</button>
                      <button class="view-btn" onclick="messageCall('${phone}')" style="font-size:11px">📞 Call</button>
                    ` : `
                      <button class="cart-btn" onclick="addToCart('${product.name}', ${product.price}, '${product.images?.[0] || ''}')">🛒 Cart</button>
                      <button class="view-btn" onclick="openProductModal('${product.id}')">View</button>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Insert featured section at the beginning
    const productsSection = document.querySelector(".section-header");
    if (productsSection) {
      const insertPoint = productsSection.nextElementSibling;
      if (insertPoint) {
        insertPoint.insertAdjacentHTML("beforebegin", featuredHtml);
      }
    }

  } catch (err) {
    console.error("Error loading featured ads:", err);
  }
}


function getProductRankScore(product) {

  let score = 0;

  // ── PREMIUM BOOST ─────────────────
  if (product.isPremium) {
    score += 1000;
  }

  // ── SHOP PLANS ────────────────────
  switch ((product.shopPlan || "").toLowerCase()) {

    case "gold":
      score += 500;
      break;

    case "silver":
      score += 300;
      break;

    case "bronze":
      score += 150;
      break;
  }

  // ── VERIFIED SELLER ───────────────
  if (product.seller?.isVerified) {
    score += 80;
  }

  // ── PRODUCT VIEWS ─────────────────
  score += product.views || 0;

  return score;
}

// ============================================
// RENDER PRODUCTS
// ============================================
window.renderProducts = function () {
  const container = document.getElementById("products");
  if (!container) return;

  let products = [...allProducts];

  // =========================
  // 1. CATEGORY FILTER
  // =========================
  if (currentCategory && currentCategory !== "all") {
    products = products.filter(p => p.category === currentCategory);
  }

  // =========================
  // 2. SEARCH FILTER
  // =========================
  if (searchQuery && searchQuery.length > 0) {
    products = products.filter(p => {
      const text = `
        ${p.name || ""}
        ${p.category || ""}
        ${p.description || ""}
      `.toLowerCase();

      return text.includes(searchQuery);
    });
  }

  // =========================
  // 3. PRICE FILTER
  // =========================
  products = products.filter(p => {
    const price = Number(p.price || 0);
    return price >= filterState.priceMin && price <= filterState.priceMax;
  });

  // =========================
  // 4. LOCATION FILTER
  // =========================
  if (filterState.location) {
    products = products.filter(p =>
      (p.location || "").toLowerCase().includes(filterState.location.toLowerCase())
    );
  }

  // =========================
  // 5. DATE FILTER
  // =========================
  if (filterState.dateRange !== "all") {
    const now = Date.now();

    products = products.filter(p => {
      const created = p.createdAt?.toDate
        ? p.createdAt.toDate().getTime()
        : new Date(p.createdAt || 0).getTime();

      if (!created) return false;

      const diff = now - created;

      if (filterState.dateRange === "24h") return diff <= 86400000;
      if (filterState.dateRange === "7d") return diff <= 7 * 86400000;
      if (filterState.dateRange === "30d") return diff <= 30 * 86400000;

      return true;
    });
  }

  // =========================
  // 6. SORTING
  // =========================
  switch (filterState.sortBy) {
    case "price-low":
      products.sort((a, b) => a.price - b.price);
      break;

    case "price-high":
      products.sort((a, b) => b.price - a.price);
      break;

    case "views":
      products.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;

    case "newest":
    default:
     
    products.sort((a, b) => {

  // =========================
  // BOOST PRIORITY
  // =========================

  const aBoost =
    a.boost?.active || a.isPremium
      ? 1
      : 0;

  const bBoost =
    b.boost?.active || b.isPremium
      ? 1
      : 0;

  // Boosted ads first
  if (aBoost !== bBoost) {
    return bBoost - aBoost;
  }

  // =========================
  // NEWEST AFTER BOOST
  // =========================

  const aTime = a.createdAt?.toDate
    ? a.createdAt.toDate().getTime()
    : new Date(a.createdAt || 0).getTime();

  const bTime = b.createdAt?.toDate
    ? b.createdAt.toDate().getTime()
    : new Date(b.createdAt || 0).getTime();

  return bTime - aTime;
});

 break;
      
  }

  // =========================
  // 7. SAVE FILTERED GLOBAL STATE
  // =========================
  filteredProducts = products;
// =========================
// MIX BOOSTED ADS
// Sponsored products appear
// throughout listings
// =========================

const boostedProducts =
  products.filter(
    p => p.boost?.active || p.isPremium
  );

const normalProducts =
  products.filter(
    p => !p.boost?.active && !p.isPremium
  );

const mixedProducts = [];

let boostIndex = 0;
let normalIndex = 0;

// Insert sponsored ad every 4 products
while (
  boostIndex < boostedProducts.length ||
  normalIndex < normalProducts.length
) {

  // Add boosted product
  if (boostIndex < boostedProducts.length) {

    mixedProducts.push(
      boostedProducts[boostIndex]
    );

    boostIndex++;
  }

  // Add normal products
  for (let i = 0; i < 4; i++) {

    if (normalIndex < normalProducts.length) {

      mixedProducts.push(
        normalProducts[normalIndex]
      );

      normalIndex++;
    }
  }
}

// Replace products list
products = mixedProducts;
  // =========================
  // 8. RENDER UI
  // =========================
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:#666;">
        No products found 😕
      </div>
    `;
    return;
  }

  products.forEach(p => {

  const card = document.createElement("div");

  card.className = "product-card";

  // Needed for Sponsored badge positioning
  card.style.position = "relative";

  card.innerHTML = `

    ${(p.boost?.active || p.isPremium) ? `
      <div style="
        position:absolute;
        top:8px;
        left:8px;
        background:#ff6600;
        color:white;
        padding:4px 8px;
        font-size:12px;
        font-weight:700;
        border-radius:6px;
        z-index:10;
      ">
        Sponsored
      </div>
    ` : ""}

    <div class="product-image">
      <img
        src="${(p.images && p.images[0]) || 'placeholder.jpg'}"
        alt="${p.name}"
      >
    </div>

    <div class="product-info">

      <h3>
        ${p.name || "No name"}
      </h3>

      <p class="price">
        UGX ${Number(p.price || 0).toLocaleString()}
      </p>

      <p class="location">
        📍 ${p.location || "Unknown"}
      </p>

<div style="
  display:flex;
  gap:8px;
  margin-top:12px;
">

  <button
    onclick="window.location.href='product.html?id=${p.id}'"
    style="
      flex:1;
      background:#ff6600;
      color:white;
      border:none;
      padding:10px;
      border-radius:8px;
      font-weight:700;
      cursor:pointer;
    "
  >
    View
  </button>

  <button
    onclick="startChat('${p.userId}')"
    style="
      flex:1;
      background:#111827;
      color:white;
      border:none;
      padding:10px;
      border-radius:8px;
      font-weight:700;
      cursor:pointer;
    "
  >
    Chat
  </button>

</div>

    </div>
  `;

  container.appendChild(card);

});
    
};

// ============================================
// CATEGORY FILTER
// ============================================

window.filterCategory = function(category) {
  currentCategory = category;

  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  event?.target?.classList.add("active");

  renderProducts();

window.openSellerShop = function(userId) {

  window.location.href =
    `shop.html?seller=${userId}`;

};

};

// ============================================
// APPLY FILTERS
// ============================================

window.applyFilters = function() {
  filterState.priceMin = Number(document.getElementById("price-min")?.value || 0);
  filterState.priceMax = Number(document.getElementById("price-max")?.value || 99999999);
  filterState.location = document.getElementById("filter-location")?.value || "";
  filterState.sortBy = document.getElementById("filter-sort")?.value || "newest";

  renderProducts();
  closeFilters();
};

window.resetFilters = function() {
  filterState = {
    priceMin: 0,
    priceMax: 99999999,
    location: "",
    dateRange: "all",
    sortBy: "newest"
  };
  
  if (document.getElementById("price-min")) document.getElementById("price-min").value = "0";
  if (document.getElementById("price-max")) document.getElementById("price-max").value = "99999999";
  if (document.getElementById("filter-location")) document.getElementById("filter-location").value = "";
  if (document.getElementById("filter-sort")) document.getElementById("filter-sort").value = "newest";

  renderProducts();
};

window.toggleFilters = function() {
  const panel = document.getElementById("filters-panel");
  if (panel) {
    panel.classList.toggle("active");
  }
};

window.closeFilters = function() {
  const panel = document.getElementById("filters-panel");
  if (panel) {
    panel.classList.remove("active");
  }
};

// ============================================
// CART FUNCTIONS
// ============================================

window.addToCart = function(name, price, image) {
  let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
  }

  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
  updateCartUI();
  showToast(`✅ Added to cart`);
};

window.toggleCart = function() {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("overlay");
  
  if (sidebar) {
    sidebar.classList.toggle("active");
  }
  if (overlay) {
    overlay.classList.toggle("active");
  }
  
  renderCartItems();
};

window.closeCart = function() {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("overlay");
  
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
};

function renderCartItems() {
  const cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  const container = document.getElementById("cart-items");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">Your cart is empty</p>`;
    return;
  }

  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p class="item-price">UGX ${Number(item.price).toLocaleString()}</p>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateQty(${idx}, -1)">−</button>
          <span class="qty-count">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${idx}, 1)">+</button>
          <button class="remove-btn" onclick="removeFromCart(${idx})">Remove</button>
        </div>
      </div>
    </div>
  `).join("");

  updateCartTotal();
}

window.updateQty = function(idx, change) {
  let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  cart[idx].qty += change;
  
  if (cart[idx].qty <= 0) {
    cart.splice(idx, 1);
  }
  
  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
  renderCartItems();
};

window.removeFromCart = function(idx) {
  let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  cart.splice(idx, 1);
  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
  renderCartItems();
};

function updateCartTotal() {
  const cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;
  });

  const totalEl = document.getElementById("cart-total");
  if (totalEl) {
    totalEl.textContent = Number(total).toLocaleString();
  }
}

function updateCartUI() {
  const cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  const badge = document.getElementById("cart-count");
  
  if (badge) {
    badge.textContent = cart.length;
  }
}

window.checkout = function() {
  const name = document.getElementById("customer-name")?.value.trim();
  const phone = document.getElementById("customer-phone")?.value.trim();
  const location = document.getElementById("customer-location")?.value.trim();

  if (!name || !phone || !location) {
    alert("Please fill all delivery details");
    return;
  }

  window.location.href = "payment.html";
};

// ============================================
// PRODUCT MODAL
// ============================================

window.openProductModal = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  
  if (!product) {
    console.error("Product not found:", productId);
    alert("Product not found");
    return;
  }

  try {
    // Get modal elements
    const modal = document.getElementById("product-modal");
    const overlay = document.getElementById("overlay");
    const modalImage = document.getElementById("modal-image");
    const modalName = document.getElementById("modal-name");
    const modalPrice = document.getElementById("modal-price");
    const modalCat = document.getElementById("modal-cat");
    const modalCartBtn = document.getElementById("modal-cart-btn");
    const modalViewBtn = document.getElementById("modal-view-btn");

    if (!modal || !modalImage || !modalName) {
      console.error("Modal elements missing");
      return;
    }

    // Fill data
    modalImage.src = product.images?.[0] || "https://via.placeholder.com/300";
    modalName.textContent = product.name;
    modalPrice.textContent = `UGX ${Number(product.price).toLocaleString()}`;
    if (modalCat) modalCat.textContent = product.category || "Product";

    // Set button actions
    if (modalCartBtn) {
      modalCartBtn.onclick = () => {
        addToCart(product.name, product.price, product.images?.[0] || "");
        closeProductModal();
      };
    }

    if (modalViewBtn) {
      modalViewBtn.onclick = () => {
        window.location.href = `product.html?id=${productId}`;
      };
    }

    // Show modal
    modal.classList.add("open");
    if (overlay) overlay.classList.add("active");

  } catch (err) {
    console.error("Modal error:", err);
    alert("Error opening product details");
  }
};

window.closeProductModal = function() {
  const modal = document.getElementById("product-modal");
  const overlay = document.getElementById("overlay");
  
  if (modal) modal.classList.remove("open");
  if (overlay) overlay.classList.remove("active");
};
// ============================================
// SEARCH
// ============================================

window.searchProducts = function () {
  const input = document.getElementById("search-input");
  const box = document.getElementById("search-suggestions");

  if (!input) return;

  searchQuery = input.value.toLowerCase().trim();

  renderProducts();

  // hide suggestions if empty
  if (!box) return;

  if (!searchQuery) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const matches = (window.allProducts || [])
    .filter(p => {
      const text = `${p.name || ""} ${p.category || ""}`.toLowerCase();
      return text.includes(searchQuery);
    })
    .slice(0, 6);

  box.innerHTML = "";

  if (matches.length === 0) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";

  matches.forEach(product => {
    const div = document.createElement("div");
    div.className = "search-suggestion-item";
    div.textContent = product.name;

    div.onclick = () => {
      input.value = product.name;
      searchQuery = product.name.toLowerCase();
      box.style.display = "none";
      renderProducts();
    };

    box.appendChild(div);
  });
};

// ============================================
// WHATSAPP & CALL
// ============================================

window.messageWhatsApp = function(phone, productName, price) {
  const message = `Hi! I'm interested in *${productName}* for UGX ${Number(price).toLocaleString()}. Is it still available?`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
};

window.messageCall = function(phone) {
  window.location.href = `tel:+${phone}`;
};

// ============================================
// TOAST
// ============================================

export function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast success";
  toast.textContent = message;
  toast.style.cssText = `
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    margin-bottom: 10px;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

// ============================================
// INITIALIZE ON LOAD
// ============================================

updateCartUI();


// ============================================
// ADMIN SECRET TRIGGER
// ============================================

let adminClickCount = 0;
let adminClickTimeout;

const logoBtn = document.getElementById("secret-admin-trigger");
if (logoBtn) {
  logoBtn.addEventListener("click", () => {
    adminClickCount++;
    
    clearTimeout(adminClickTimeout);
    
    if (adminClickCount === 5) {
      openAdminLoginModal();
      adminClickCount = 0;
    }
    
    adminClickTimeout = setTimeout(() => {
      adminClickCount = 0;
    }, 2000);
  });
}

const adminBoostBtn = document.getElementById("admin-boost-btn");
if (adminBoostBtn && currentUser?.email === "swaibuziraye22@gmail.com") {
  adminBoostBtn.style.display = "block";
}

window.deleteProduct = async function(productId) {

  const confirmDelete = confirm("Delete this ad permanently?");

  if (!confirmDelete) return;

  try {

    await deleteDoc(doc(db, "products", productId));

    allProducts = allProducts.filter(p => p.id !== productId);
window.allProducts = allProducts;

    renderProducts();

    alert("✅ Ad deleted");

  } catch (err) {

    console.error(err);
    alert("❌ Failed to delete");

  }
};


