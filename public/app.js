// ============================================
// ZiBuy — Main App Logic
// ============================================

import { db, auth, collection, getDocs, addDoc, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFeaturedAds } from "./premium-ads.js";
import "./auth.js";

// ============================================
// GLOBALS
// ============================================

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
// AUTH STATE LISTENER
// ============================================

function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    // Safely update all DOM elements
    const elements = {
      "post-ad-btn": user ? "block" : "none",
      "dashboard-btn": user ? "block" : "none",
      "messages-btn": user ? "block" : "none",
      "notifications-btn": user ? "block" : "none"
    };

    // Update each element safely
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
// LOAD PRODUCTS FROM FIRESTORE
// ============================================

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    allProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Load featured ads first
    await loadFeaturedProducts();

    // Then render all products
    renderProducts();

  } catch (err) {
    console.error("Error loading products:", err);
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

// ============================================
// RENDER PRODUCTS
// ============================================

function renderProducts() {
  const container = document.getElementById("products");
  if (!container) return;

  let filtered = allProducts.filter(p => {
    if (currentCategory !== "all" && p.category !== currentCategory) return false;
    if (p.price < filterState.priceMin || p.price > filterState.priceMax) return false;
    if (filterState.location && p.location !== filterState.location) return false;
    return true;
  });

  // Sort
  if (filterState.sortBy === "price-low") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (filterState.sortBy === "price-high") {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="font-size:48px;margin-bottom:12px">🔍</p>
        <p>No products found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const phone = (p.seller?.phone || "").replace(/\D/g, "");
    const hasPhone = phone.length > 0 && p.isUserPost === true;

    return `
      <div class="product-card">
        <div class="product-image-box">
          <img src="${p.images?.[0] || ''}" alt="${p.name}">
          <button class="save-btn" onclick="saveProduct('${p.id}')">💝</button>
          ${p.isPremium ? '<span class="premium-badge">⭐ FEATURED</span>' : ''}
        </div>
        <div class="product-info">
          <p class="product-cat">${p.category}</p>
          <h3 class="product-title">${p.name}</h3>
          <p class="product-price">UGX ${Number(p.price).toLocaleString()}</p>
          ${p.seller?.location ? `<p class="product-seller-loc">📍 ${p.seller.location}</p>` : ''}
          <div class="card-footer">
            ${hasPhone ? `
              <button class="cart-btn" onclick="messageWhatsApp('${phone}', '${p.name}', ${p.price})">💬</button>
              <button class="view-btn" onclick="messageCall('${phone}')">☎️</button>
            ` : `
              <button class="cart-btn" onclick="addToCart('${p.name}', ${p.price}, '${p.images?.[0] || ''}')">🛒</button>
              <button class="view-btn" onclick="openProductModal('${p.id}')">View</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("product-count").textContent = `${filtered.length} listings`;
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
  if (!product) return;

  const modal = document.getElementById("product-modal");
  if (!modal) return;

  document.getElementById("modal-image").src = product.images?.[0] || "";
  document.getElementById("modal-name").textContent = product.name;
  document.getElementById("modal-price").textContent = `UGX ${Number(product.price).toLocaleString()}`;
  document.getElementById("modal-cat").textContent = product.category;

  modal.classList.add("open");
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.classList.add("active");
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

window.searchProducts = function() {
  const query = document.getElementById("search-input")?.value.toLowerCase() || "";
  
  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.description.toLowerCase().includes(query)
  );

  const container = document.getElementById("products");
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>No products match your search</p></div>`;
    return;
  }

  // Render filtered results
  container.innerHTML = filtered.map(p => {
    const phone = (p.seller?.phone || "").replace(/\D/g, "");
    const hasPhone = phone.length > 0 && p.isUserPost === true;

    return `
      <div class="product-card">
        <div class="product-image-box">
          <img src="${p.images?.[0] || ''}" alt="${p.name}">
        </div>
        <div class="product-info">
          <p class="product-cat">${p.category}</p>
          <h3 class="product-title">${p.name}</h3>
          <p class="product-price">UGX ${Number(p.price).toLocaleString()}</p>
          <div class="card-footer">
            ${hasPhone ? `
              <button class="cart-btn" onclick="messageWhatsApp('${phone}', '${p.name}', ${p.price})">💬</button>
              <button class="view-btn" onclick="messageCall('${phone}')">☎️</button>
            ` : `
              <button class="cart-btn" onclick="addToCart('${p.name}', ${p.price}, '${p.images?.[0] || ''}')">🛒</button>
              <button class="view-btn" onclick="openProductModal('${p.id}')">View</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");
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