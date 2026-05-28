// ============================================
// ZiBuy — Main App Logic
// ============================================

import { db, auth, collection, getDocs, addDoc, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFeaturedAds } from "./premium-ads.js";
import "./auth.js";
import { deleteDoc, doc } from "./firebase.js";
import { getRankedProducts } from "./ranking-service.js";

// ============================================
// GLOBALS
// ============================================

let searchQuery = "";
let filteredProducts = [];
let currentUser = null;

let currentCategory = "all";

let filterState = {
  priceMin: 0,
  priceMax: 99999999,
  location: "",
  dateRange: "all",
  sortBy: "newest"
};

// 🔥 FIX: single source of truth
window.allProducts = [];
let allProducts = window.allProducts;

// ============================================
// INIT
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
// AUTH
// ============================================

function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    const elements = {
      "post-ad-btn": user ? "block" : "none",
      "dashboard-btn": user ? "block" : "none",
      "upgrade-btn": user ? "block" : "none",
      "messages-btn": user ? "block" : "none",
      "notifications-btn": user ? "block" : "none"
    };

    Object.keys(elements).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = elements[id];
    });
  });
}

// ============================================
// LOAD PRODUCTS
// ============================================

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    const products = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const product = { id: docSnap.id, ...docSnap.data() };

        product.seller = product.seller || {};

        return product;
      })
    );

    // 🔥 FIX IMPORTANT
    window.allProducts = products;
    allProducts = window.allProducts;

    filteredProducts = [...allProducts];

    loadFeaturedProducts();
    renderProducts();

  } catch (err) {
    console.error(err);
  }
}

// ============================================
// FEATURED
// ============================================

async function loadFeaturedProducts() {
  try {
    const featured = await getFeaturedAds();
    console.log("Featured:", featured.length);
  } catch (err) {
    console.error(err);
  }
}

// ============================================
// SAFE RENDER
// ============================================

function renderProducts() {
  const container = document.getElementById("products");
  if (!container) return;

  let filtered = allProducts.filter(p => {

    if (!p) return false;

    if (searchQuery &&
      !(p.name || "").toLowerCase().includes(searchQuery)) {
      return false;
    }

    if (p.hidden) return false;

    if (currentCategory !== "all" &&
      p.category !== currentCategory) {
      return false;
    }

    if (p.price < filterState.priceMin ||
      p.price > filterState.priceMax) {
      return false;
    }

    if (filterState.location &&
      p.location !== filterState.location) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) =>
    (b.rankScore || 0) - (a.rankScore || 0)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No products</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="product-card">
      <img src="${p.images?.[0] || ''}">
      <h3>${p.name || ''}</h3>
      <p>UGX ${Number(p.price || 0).toLocaleString()}</p>
    </div>
  `).join("");

  const countEl = document.getElementById("product-count");
  if (countEl) countEl.textContent = `${filtered.length} listings`;
}

// ============================================
// CATEGORY FILTER (FIXED)
// ============================================

window.filterCategory = function(category) {
  currentCategory = category;
  renderProducts();
};

// ============================================
// SEARCH (ONLY ONE VERSION FIXED)
// ============================================

window.searchProducts = function () {
  const input = document.getElementById("search-input");
  if (!input) return;

  searchQuery = input.value.toLowerCase().trim();
  renderProducts();
};

// ============================================
// CART SAFE
// ============================================

window.addToCart = function(name, price, image) {
  let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  cart.push({ name, price, image, qty: 1 });
  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
};