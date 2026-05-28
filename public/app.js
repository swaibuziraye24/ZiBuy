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
  getRankedProducts
} from "./ranking-service.js";
// ============================================
// GLOBALS
// ============================================
let searchQuery = "";
let filteredProducts = [];
let currentUser = null;
let allProducts = [];
let currentCategory = "all";
let filterState = {
  priceMin: 0,
  priceMax: 99999999,
  location: "",
  dateRange: "all",
  sortBy: "newest"
};

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
allProducts = products.sort(
  (a, b) => b.rankScore - a.rankScore
);

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

function renderProducts() {

  const container =
    document.getElementById("products");

  if (!container) return;

  let filtered = allProducts.filter(p => {

    /* =========================
       SMART SEARCH
    ========================== */
    if (searchQuery) {

      const searchableText = `
        ${p.name || ""}
        ${p.description || ""}
        ${p.category || ""}
        ${p.location || ""}
        ${p.seller?.name || ""}
      `.toLowerCase();

      if (!searchableText.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    /* =========================
       HIDE BLOCKED / EXPIRED
    ========================== */
    if (p.hidden === true) return false;
    if (p.status === "expired") return false;

    /* =========================
       CATEGORY FILTER
    ========================== */
    if (
      currentCategory !== "all" &&
      p.category !== currentCategory
    ) {
      return false;
    }

    /* =========================
       PRICE FILTER
    ========================== */
    if (
      p.price < filterState.priceMin ||
      p.price > filterState.priceMax
    ) {
      return false;
    }

    /* =========================
       LOCATION FILTER
    ========================== */
    if (
      filterState.location &&
      p.location !== filterState.location
    ) {
      return false;
    }

    return true;
  });

  // ============================================
  // SMART SORTING + PREMIUM RANKING
  // ============================================

  filtered.sort((a, b) => {

    // PREMIUM FIRST
    if (a.isPremium && !b.isPremium) return -1;
    if (!a.isPremium && b.isPremium) return 1;

    const aBoost = a.rankScore || 0;
    const bBoost = b.rankScore || 0;

    if (filterState.sortBy === "price-low") {
      return a.price - b.price;
    }

    if (filterState.sortBy === "price-high") {
      return b.price - a.price;
    }

    if (filterState.sortBy === "views") {
      return (b.views || 0) - (a.views || 0);
    }

    // DEFAULT: BOOST + NEWEST
    return (
      bBoost - aBoost ||
      new Date(b.createdAt) - new Date(a.createdAt)
    );

  });

  // ============================================
  // EMPTY STATE
  // ============================================

  if (filtered.length === 0) {

    container.innerHTML = `
      <div class="empty-state">
        <p style="font-size:48px;margin-bottom:12px">🔍</p>
        <p>No products found</p>
      </div>
    `;

    return;
  }

  // ============================================
  // RENDER PRODUCTS
  // ============================================

  container.innerHTML = filtered.map(p => {

    const images = p.images || [];

    return `
      <div class="product-card">

        <div class="product-image-box" style="position:relative">

          <img src="${images[0] || ''}" alt="${p.name || 'Product'}">

          ${p.isPremium ? `
            <span class="premium-badge">⭐ FEATURED</span>
          ` : ''}

        </div>

        <div class="product-info">

          <p class="product-cat">${p.category || "General"}</p>

          <h3 class="product-title">
            ${p.name || "Untitled Product"}

            ${p.seller?.isVerified ? `
              <span style="color:#10b981;font-size:13px;font-weight:800;margin-left:6px;">
                ✅ Verified
              </span>
            ` : ''}
          </h3>

          <p class="product-price">
            UGX ${Number(p.price || 0).toLocaleString()}
          </p>

          <div class="product-seller-loc">

            <span
              onclick="openSellerShop('${p.userId}')"
              style="cursor:pointer;font-weight:700;color:#ff6600;"
            >
              🏪 ${p.seller?.name || "Seller"}
            </span>

            <br>

            📍 ${p.seller?.location || "Uganda"}

          </div>

          <div class="card-footer">

            <button class="cart-btn"
              onclick="addToCart('${(p.name || "").replace(/'/g,"\\'")}', ${p.price || 0}, '${images[0] || ""}')">
              🛒 Add
            </button>

            <button class="view-btn"
              onclick="openProductModal('${p.id}')">
              View
            </button>

          </div>

          ${currentUser?.email === "swaibuziraye22@gmail.com" ? `
            <button class="admin-delete-btn"
              onclick="deleteProduct('${p.id}')">
              🗑 Delete Ad
            </button>
          ` : ''}

        </div>
      </div>
    `;

  }).join("");

  // ============================================
  // COUNT
  // ============================================

  const countEl =
    document.getElementById("product-count");

  if (countEl) {
    countEl.textContent = `${filtered.length} listings`;
  }
}

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

  const input =
    document.getElementById("search-input");

  const suggestionsBox =
    document.getElementById("search-suggestions");

  if (!input) return;

  searchQuery =
    input.value.toLowerCase().trim();

  renderProducts();

  // CLEAR SUGGESTIONS
  suggestionsBox.innerHTML = "";

  if (!searchQuery) {
    suggestionsBox.style.display = "none";
    return;
  }

  // FIND MATCHES
  const matches = allProducts.filter(p => {

    const text = `
      ${p.name || ""}
      ${p.category || ""}
    `.toLowerCase();

    return text.includes(searchQuery);

  }).slice(0, 6);

  // SHOW SUGGESTIONS
  if (matches.length > 0) {

    suggestionsBox.style.display = "block";

    matches.forEach(product => {

      const div =
        document.createElement("div");

      div.className =
        "search-suggestion-item";

      div.innerHTML = `
        🔍 ${product.name}
      `;

      div.onclick = () => {

        input.value = product.name;

        searchQuery =
          product.name.toLowerCase();

        suggestionsBox.style.display =
          "none";

        renderProducts();
      };

      suggestionsBox.appendChild(div);

    });

  } else {

    suggestionsBox.style.display =
      "none";
  }
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

    renderProducts();

    alert("✅ Ad deleted");

  } catch (err) {

    console.error(err);
    alert("❌ Failed to delete");

  }
};


window.handleSearch = function(value) {

  searchQuery =
    value.toLowerCase().trim();

  renderProducts();

};

window.filterCategory = function(category) {

  currentCategory = category;

  renderProducts();

};

// ============================================
// SMART SEARCH SYSTEM
// ============================================

window.searchProducts = function () {

  const input =
    document.getElementById("search-input");

  if (!input) return;

  searchQuery =
    input.value.toLowerCase().trim();

  renderProducts();
};

// HIDE SEARCH SUGGESTIONS
document.addEventListener("click", (e) => {

  const box =
    document.getElementById(
      "search-suggestions"
    );

  const input =
    document.getElementById(
      "search-input"
    );

  if (!box || !input) return;

  if (
    !box.contains(e.target) &&
    e.target !== input
  ) {
    box.style.display = "none";
  }
});