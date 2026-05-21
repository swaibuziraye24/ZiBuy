// ============================================
//   ZiBuy — Main App
// ============================================

import {
  db,
  collection, getDocs, addDoc
} from "./firebase.js";

import "./auth.js";
import "./admin.js";

// ============================================
//   TOAST NOTIFICATIONS
// ============================================

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

  const name     = document.getElementById("customer-name").value.trim();
  const phone    = document.getElementById("customer-phone").value.trim();
  const location = document.getElementById("customer-location").value.trim();

  if (!name || !phone || !location) {
    showToast("Please fill in your delivery details", "error");
    return;
  }

  const checkoutBtn = document.querySelector(".checkout-btn");
  checkoutBtn.textContent = "Placing order...";
  checkoutBtn.disabled = true;

  try {
    let total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const orderId = "ZB-" + Date.now();

    await addDoc(collection(db, "orders"), {
      orderId,
      customerName:     name,
      customerPhone:    phone,
      customerLocation: location,
      items:            cart,
      total,
      status:           "Pending",
      paymentMethod:    "Cash On Delivery",
      createdAt:        new Date()
    });

    showToast(`Order ${orderId} placed! 🎉`, "success");

    cart = [];
    saveCart();
    renderCart();

    document.getElementById("customer-name").value     = "";
    document.getElementById("customer-phone").value    = "";
    document.getElementById("customer-location").value = "";

    window.closeCart();

  } catch (err) {
    console.error(err);
    showToast("Checkout failed. Try again.", "error");
  } finally {
    checkoutBtn.textContent = "Place Order";
    checkoutBtn.disabled    = false;
  }
};

// ============================================
//   PRODUCT QUICK-VIEW MODAL
// ============================================

let modalImages = [];
let modalCurrentImg = 0;

window.openProduct = function(name, price, images, category, productId) {
  modalImages = Array.isArray(images) ? images : [images];
  modalCurrentImg = 0;

  document.getElementById("modal-image").src       = modalImages[0] || "";
  document.getElementById("modal-name").textContent  = name;
  document.getElementById("modal-price").textContent = "UGX " + Number(price).toLocaleString();
  document.getElementById("modal-cat").textContent   = category || "";

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
    let count = 0;

    snapshot.forEach((docSnap) => {
      const p = docSnap.data();

      // Filter by category
      if (activeCategory !== "all" && p.category !== activeCategory) return;

      // Filter by search
      if (searchValue && !p.name.toLowerCase().includes(searchValue)) return;

      const images = Array.isArray(p.images) ? p.images : [];
      const firstImg = images[0] || "";
      count++;

      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-image-box" onclick="openProduct('${p.name.replace(/'/g,"\\'")}', ${p.price}, ${JSON.stringify(images)}, '${p.category || ""}', '${docSnap.id}')">
          <div class="slider">
            ${images.map((img, i) =>
              `<img src="${img}" class="product-image ${i === 0 ? 'active' : ''}" alt="${p.name}">`
            ).join("")}
          </div>
          <button class="save-btn" onclick="event.stopPropagation(); this.textContent = this.textContent === '🤍' ? '❤️' : '🤍'">🤍</button>
        </div>
        <div class="product-info">
          <p class="product-cat">${p.category || ""}</p>
          <h3 class="product-title">${p.name}</h3>
          <p class="product-price">UGX ${Number(p.price).toLocaleString()}</p>
          <div class="card-footer">
            <button class="cart-btn" onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${firstImg}')">Add to Cart</button>
            <button class="view-btn" onclick="window.location.href='product.html?id=${docSnap.id}'">View</button>
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

    if (count === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No products found</p>
          <p style="font-size:13px;margin-top:6px">Try a different category or search term</p>
        </div>`;
    }

    // Update count label
    const countEl = document.getElementById("product-count");
    if (countEl) countEl.textContent = count + " ads found";

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