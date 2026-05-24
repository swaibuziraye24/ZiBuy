// ============================================
//   ZiBuy — Main App
// ============================================

import {
  db, auth,
  collection, getDocs, addDoc
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import "./auth.js";

// Check if user is logged in when page loads
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is logged in - show buttons
    document.getElementById("post-ad-btn").style.display = "block";
    document.getElementById("dashboard-btn").style.display = "block";
    document.getElementById("notifications-btn").style.display = "block";
    document.getElementById("messages-btn").style.display = "block";
    
    // Change account button to logout
    const accountBtn = document.getElementById("account-btn");
    accountBtn.textContent = "🚪 Logout";
    accountBtn.onclick = function() {
      auth.signOut().then(() => {
        alert("Logged out!");
        location.reload();
      });
    };
  } else {
    // User is NOT logged in - hide buttons
    document.getElementById("post-ad-btn").style.display = "none";
    document.getElementById("dashboard-btn").style.display = "none";
    document.getElementById("notifications-btn").style.display = "none";
    document.getElementById("messages-btn").style.display = "none";
    
    // Reset account button
    const accountBtn = document.getElementById("account-btn");
    accountBtn.textContent = "Account";
    accountBtn.onclick = function() {
      openAuthModal();
    };
  }
});

// ============================================
//   TOAST NOTIFICATIONS
//   ============================================

export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "🔔" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastIn .3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.showToast = showToast;

// ============================================
//   CART SYSTEM
// ============================================

let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];

function saveCart() {
  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
}

export function renderCart() {
  const container = document.getElementById("cart-items");
  const totalEl   = document.getElementById("cart-total");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Your cart is empty</p>
        <p style="font-size:13px;margin-top:6px;color:#adb5bd">Add items to get started</p>
      </div>`;
    if (totalEl) totalEl.textContent = "0";
    updateCartCount();
    return;
  }

  let total = 0;
  container.innerHTML = "";

  cart.forEach((item, index) => {
    total += item.price * item.qty;
    container.innerHTML += `
      <div class="cart-item">
        <img src="${item.image || ''}" onerror="this.style.display='none'" alt="${item.name}">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p class="item-price">UGX ${item.price.toLocaleString()}</p>
          <div class="qty-controls">
            <button class="qty-btn" onclick="changeQty(${index}, -1)">−</button>
            <span class="qty-count">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
          </div>
          <button class="remove-btn" onclick="removeCartItem(${index})">Remove</button>
        </div>
      </div>`;
  });

  if (totalEl) totalEl.textContent = total.toLocaleString();
  updateCartCount();
}

window.addToCart = function(name, price, image = "") {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
  }
  saveCart();
  renderCart();
  showToast(`${name} added to cart 🛒`, "success");
};

window.changeQty = function(index, change) {
  cart[index].qty += change;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
  renderCart();
};

window.removeCartItem = function(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
};

window.toggleCart = function() {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("overlay");
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
};

window.closeCart = function() {
  document.getElementById("cart-sidebar").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
};

// ============================================
//   CHECKOUT
// ============================================

window.checkout = async function() {
  if (cart.length === 0) {
    showToast("Your cart is empty", "error");
    return;
  }

  // Just redirect to payment page - they'll login there if needed
  window.location.href = "payment.html";
};

// ============================================
//   PRODUCT QUICK-VIEW MODAL
// ============================================

let modalImages = [];
let modalCurrentImg = 0;

window.openProduct = function(name, price, images, category, productId, seller) {
  modalImages = Array.isArray(images) ? images : [images];
  modalCurrentImg = 0;

  document.getElementById("modal-image").src        = modalImages[0] || "";
  document.getElementById("modal-name").textContent  = name;
  document.getElementById("modal-price").textContent = "UGX " + Number(price).toLocaleString();
  document.getElementById("modal-cat").textContent   = category || "";

  // Seller info strip
  const sellerInfoEl = document.getElementById("modal-seller-info");
  if (seller && seller.name) {
    sellerInfoEl.innerHTML = `
      <span class="modal-seller-name">👤 ${seller.name}</span>
      <span class="modal-seller-loc">📍 ${seller.location || "Uganda"}</span>
    `;
  } else {
    sellerInfoEl.innerHTML = "";
  }

  // WhatsApp + Call buttons
  const contactEl = document.getElementById("modal-contact-btns");
  if (seller && seller.phone) {
    const phone    = seller.phone.replace(/\D/g, ""); // digits only
    const waMsg    = encodeURIComponent(`Hi, I saw *${name}* on ZiBuy for UGX ${Number(price).toLocaleString()}. Is it still available?`);
    contactEl.innerHTML = `
      <a class="contact-btn whatsapp-btn" href="https://wa.me/${phone}?text=${waMsg}" target="_blank">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.857L.057 23.8l6.088-1.439A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.788 9.788 0 01-5.002-1.368l-.36-.214-3.716.878.938-3.63-.235-.373A9.789 9.789 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
        WhatsApp Seller
      </a>
      <a class="contact-btn call-btn" href="tel:+${phone}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        Call Seller
      </a>
    `;
  } else {
    contactEl.innerHTML = "";
  }

  // Dots
  const dotsEl = document.getElementById("modal-dots");
  dotsEl.innerHTML = modalImages.map((_, i) =>
    `<button class="modal-dot ${i === 0 ? 'active' : ''}" onclick="modalGoTo(${i})"></button>`
  ).join("");

  // Cart button
  document.getElementById("modal-cart-btn").onclick = () => {
    window.addToCart(name, price, modalImages[0]);
  };

  // View full page
  document.getElementById("modal-view-btn").onclick = () => {
    window.location.href = `product.html?id=${productId}`;
  };

  document.getElementById("product-modal").classList.add("open");
};

window.modalGoTo = function(index) {
  modalCurrentImg = index;
  document.getElementById("modal-image").src = modalImages[index];
  document.querySelectorAll(".modal-dot").forEach((d, i) =>
    d.classList.toggle("active", i === index)
  );
};

window.closeProductModal = function() {
  document.getElementById("product-modal").classList.remove("open");
};

// ============================================
//   LOAD PRODUCTS FROM FIRESTORE
// ============================================

let activeCategory = "all";
let searchValue    = "";

// ---- FILTER STATE ----
let filterState = {
  priceMin: 0,
  priceMax: 99999999,
  location: "",
  dateRange: "all",
  sortBy: "newest"
};

window.toggleFilters = function() {
  const panel = document.getElementById("filters-panel");
  const overlay = document.getElementById("overlay");
  
  if (panel) {
    panel.classList.toggle("active");
    if (overlay) {
      overlay.classList.toggle("active");
    }
  }
};
// ============ UPDATE PRICE RANGE ============
window.updatePriceRange = function() {
  let minVal = Number(document.getElementById("price-range-min").value);
  let maxVal = Number(document.getElementById("price-range-max").value);

  if (minVal > maxVal) {
    document.getElementById("price-range-min").value = maxVal;
    minVal = maxVal;
  }
  if (maxVal < minVal) {
    document.getElementById("price-range-max").value = minVal;
    maxVal = minVal;
  }

  document.getElementById("price-min").value = minVal;
  document.getElementById("price-max").value = maxVal;
  document.getElementById("price-display-min").textContent = minVal.toLocaleString();
  document.getElementById("price-display-max").textContent = maxVal.toLocaleString();
};

// ============ APPLY FILTERS ============
window.applyFilters = function() {
  filterState.priceMin = Number(document.getElementById("price-min").value) || 0;
  filterState.priceMax = Number(document.getElementById("price-max").value) || 99999999;
  filterState.location = document.getElementById("filter-location").value;
  filterState.sortBy = document.getElementById("filter-sort").value;
  
  // Get selected date filter
  const dateRadios = document.querySelectorAll("input[name='date-filter']");
  dateRadios.forEach(radio => {
    if (radio.checked) {
      filterState.dateRange = radio.value;
    }
  });

  updateActiveFiltersDisplay();
  loadProducts();
};

// ============ RESET FILTERS ============
window.resetFilters = function() {
  document.getElementById("price-min").value = 0;
  document.getElementById("price-max").value = 99999999;
  document.getElementById("price-range-min").value = 0;
  document.getElementById("price-range-max").value = 99999999;
  document.getElementById("filter-location").value = "";
  document.getElementById("filter-sort").value = "newest";
  document.querySelector("input[name='date-filter'][value='all']").checked = true;
  
  filterState = {
    priceMin: 0,
    priceMax: 99999999,
    location: "",
    dateRange: "all",
    sortBy: "newest"
  };

  // ✅ NEW: Clear active filters display
  updateActiveFiltersDisplay();
  
  // ✅ NEW: Reset price display
  document.getElementById("price-display-min").textContent = "0";
  document.getElementById("price-display-max").textContent = "99999999";
  
  // ✅ NEW: Close filter panel
  const panel = document.getElementById("filters-panel");
  if (panel) {
    panel.classList.remove("active");
  }
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  
  // ✅ NEW: Show confirmation
  showToast("Filters reset ✅", "success");
  
  // ✅ Reload products
  loadProducts();
};


window.resetPriceFilter = function() {
  document.getElementById("price-min").value = 0;
  document.getElementById("price-max").value = 99999999;
  document.getElementById("price-range-min").value = 0;
  document.getElementById("price-range-max").value = 99999999;
  filterState.priceMin = 0;
  filterState.priceMax = 99999999;
  document.getElementById("price-display-min").textContent = "0";
  document.getElementById("price-display-max").textContent = "99999999";
  updateActiveFiltersDisplay();
  loadProducts();
};

window.resetLocationFilter = function() {
  document.getElementById("filter-location").value = "";
  filterState.location = "";
  updateActiveFiltersDisplay();
  loadProducts();
};

window.resetDateFilter = function() {
  document.querySelector("input[name='date-filter'][value='all']").checked = true;
  filterState.dateRange = "all";
  updateActiveFiltersDisplay();
  loadProducts();
};

window.clearAllFilters = function() {
  resetFilters();
};

function updateActiveFiltersDisplay() {
  const container = document.getElementById("active-filters");
  if (!container) return;
  
  const filters = [];

  if (filterState.priceMin > 0 || filterState.priceMax < 99999999) {
    filters.push(`
      <span class="active-filter-tag">
        💰 UGX ${filterState.priceMin.toLocaleString()}-${filterState.priceMax.toLocaleString()}
        <button onclick="resetPriceFilter()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px">×</button>
      </span>
    `);
  }
  if (filterState.location) {
    filters.push(`
      <span class="active-filter-tag">
        📍 ${filterState.location}
        <button onclick="resetLocationFilter()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px">×</button>
      </span>
    `);
  }
  if (filterState.dateRange !== "all") {
    const dateLabels = { "7": "Last 7 days", "30": "Last 30 days" };
    filters.push(`
      <span class="active-filter-tag">
        📅 ${dateLabels[filterState.dateRange] || "All time"}
        <button onclick="resetDateFilter()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px">×</button>
      </span>
    `);
  }

  if (filters.length === 0) {
    container.innerHTML = "";
  } else {
    container.innerHTML = filters.join("");
  }
}

export async function loadProducts() {
  const grid = document.getElementById("products");
  if (!grid) return;

  // Show skeleton loaders
  grid.innerHTML = Array(8).fill(`
    <div class="skeleton">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `).join("");

  try {
    const snapshot = await getDocs(collection(db, "products"));
    grid.innerHTML = "";
    let productsArray = [];

    snapshot.forEach((docSnap) => {
      const p = docSnap.data();

      // Filter by category
      if (activeCategory !== "all" && p.category !== activeCategory) return;

      // Filter by search
      if (searchValue && !p.name.toLowerCase().includes(searchValue)) return;

      // Filter by price
      const price = Number(p.price);
      if (price < filterState.priceMin || price > filterState.priceMax) return;

      // Filter by location
      if (filterState.location && p.location !== filterState.location) return;

      // Filter by date
      if (filterState.dateRange !== "all" && p.createdAt) {
        const createdDate = p.createdAt.toDate();
        const now = new Date();
        const daysOld = (now - createdDate) / (1000 * 60 * 60 * 24);

        if (filterState.dateRange === "7" && daysOld > 7) return;
        if (filterState.dateRange === "30" && daysOld > 30) return;
      }

      // Add to array for sorting
      productsArray.push({ docSnap, data: p });
    });

    // SORT PRODUCTS
    if (filterState.sortBy === "newest") {
      productsArray.sort((a, b) => (b.data.createdAt?.toDate() || 0) - (a.data.createdAt?.toDate() || 0));
    } else if (filterState.sortBy === "oldest") {
      productsArray.sort((a, b) => (a.data.createdAt?.toDate() || 0) - (b.data.createdAt?.toDate() || 0));
    } else if (filterState.sortBy === "price-low") {
      productsArray.sort((a, b) => Number(a.data.price) - Number(b.data.price));
    } else if (filterState.sortBy === "price-high") {
      productsArray.sort((a, b) => Number(b.data.price) - Number(a.data.price));
    }

   // RENDER PRODUCTS
productsArray.forEach(({ docSnap, data: p }) => {
  const images = Array.isArray(p.images) ? p.images : [];
  const firstImg = images[0] || "";

  const card = document.createElement("div");
  card.className = "product-card";

  const seller = p.seller || {};
  const phone = (seller.phone || "").replace(/\D/g, "");
  const isCustomerProduct = p.isUserPost === true;
  const hasPhone = phone.length > 0;
  const waMsg = encodeURIComponent(`Hi, I'm interested in: ${p.name}`);

  let footerHTML = "";
  
  if (isCustomerProduct && hasPhone) {
    // ✅ CUSTOMER PRODUCT WITH PHONE - SHOW BUTTONS
    footerHTML = `
      <a href="https://wa.me/${phone}?text=${waMsg}" target="_blank" class="btn-sm" style="background:#25D366;color:white;padding:8px;border:none;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;text-align:center;flex:1;cursor:pointer">💬</a>
      <a href="tel:+${phone}" class="btn-sm" style="background:#ff6600;color:white;padding:8px;border:none;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;text-align:center;flex:1;cursor:pointer">📞</a>
    `;
  } else {
    // ✅ ADMIN PRODUCT OR NO PHONE - SHOW CART
    footerHTML = `
      <button class="cart-btn" onclick="event.stopPropagation(); addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${firstImg}')">🛒</button>
      <button class="view-btn" onclick="event.stopPropagation(); window.location.href='product.html?id=${docSnap.id}'">View</button>
    `;
  }

  card.innerHTML = `
    <div class="product-image-box" ${!isCustomerProduct || !hasPhone ? `onclick="openProduct('${p.name.replace(/'/g,"\\'")}', ${p.price}, ${JSON.stringify(images)}, '${p.category || ""}', '${docSnap.id}', ${JSON.stringify(seller)})"` : ""} style="cursor: ${!isCustomerProduct || !hasPhone ? 'pointer' : 'default'}">
      <div class="slider">
        ${images.map((img, i) =>
          `<img src="${img}" class="product-image ${i === 0 ? 'active' : ''}" alt="${p.name}">`
        ).join("")}
      </div>
      ${p.isPremium ? '<span class="premium-badge">⭐ FEATURED</span>' : ''}
      <button class="save-btn" onclick="event.stopPropagation(); this.textContent = this.textContent === '🤍' ? '❤️' : '🤍'">🤍</button>
    </div>
    <div class="product-info">
      <p class="product-cat">${p.category || ""}</p>
      <h3 class="product-title">${p.name}</h3>
      <p class="product-price">UGX ${Number(p.price).toLocaleString()}</p>
      ${seller.name ? `<p style="font-size:12px;color:#6b7280;margin-bottom:8px">👤 ${seller.name}</p>` : ""}
      ${p.location ? `<p class="product-seller-loc">📍 ${p.location}</p>` : ""}
      <div class="card-footer">
        ${footerHTML}
      </div>
    </div>
  `;

  // Auto-rotate slider images
  if (images.length > 1) {
    let idx = 0;
    setInterval(() => {
      const imgs = card.querySelectorAll(".slider img");
      imgs[idx].classList.remove("active");
      idx = (idx + 1) % imgs.length;
      imgs[idx].classList.add("active");
    }, 3000);
  }

  grid.appendChild(card);
});

    if (productsArray.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No products found</p>
          <p style="font-size:13px;margin-top:6px">Try a different category or filters</p>
        </div>`;
    }

    // Update count label
    const countEl = document.getElementById("product-count");
    if (countEl) countEl.textContent = productsArray.length + " ads found";

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load products</p></div>`;
  }
}

window.loadProducts = loadProducts;

// ---- Filter by category ----
window.filterCategory = function(cat) {
  activeCategory = cat;

  // Update active button style
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });

  loadProducts();
};

// ---- Search ----
window.searchProducts = function() {
  searchValue = document.getElementById("search-input").value.toLowerCase().trim();
  loadProducts();
};

// ============================================
//   INIT
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  renderCart();
  updateCartCount();
});


window.toggleCart = toggleCart;
window.closeCart = closeCart;
window.checkout = checkout;
window.addToCart = addToCart;


// ============================================
// SECRET ADMIN ACCESS
// Click ZiBuy logo 5 times to open admin login
// ============================================

const secretAdminTrigger = document.getElementById("secret-admin-trigger");

let adminTapCount = 0;

if (secretAdminTrigger) {

  secretAdminTrigger.addEventListener("click", () => {

    adminTapCount++;

    // Reset after 2 seconds
    setTimeout(() => {
      adminTapCount = 0;
    }, 2000);

    // Open admin after 5 clicks
    if (adminTapCount >= 5) {

      adminTapCount = 0;

      openAdminLoginModal();

    }

  });

}