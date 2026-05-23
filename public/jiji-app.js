import { db, auth, collection, getDocs } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let allProducts = [];
let featuredProducts = [];

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
});

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    allProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Featured = premium ads + top viewed
    featuredProducts = allProducts
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    renderCarousel();
    renderProducts();
  } catch (err) {
    console.error(err);
  }
}

function renderCarousel() {
  const carousel = document.getElementById("featured-carousel");
  const dots = document.getElementById("carousel-dots");

  carousel.innerHTML = featuredProducts.map(p => `
    <div class="carousel-item" onclick="window.location.href='product.html?id=${p.id}'">
      <img src="${p.images?.[0] || ''}" alt="${p.name}">
      <div class="carousel-item-info">
        <h3>${p.name}</h3>
        <div class="carousel-item-price">UGX ${Number(p.price).toLocaleString()}</div>
      </div>
    </div>
  `).join("");

  dots.innerHTML = featuredProducts.map((_, i) => `
    <div class="dot ${i === 0 ? 'active' : ''}" onclick="scrollCarousel(${i})"></div>
  `).join("");
}

function renderProducts() {
  const grid = document.getElementById("products-grid");

  grid.innerHTML = allProducts
    .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
    .slice(0, 20)
    .map(p => `
    <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="product-image">
        <img src="${p.images?.[0] || ''}" alt="${p.name}">
        ${p.isPremium ? '<span class="product-badge">⭐ FEATURED</span>' : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
        <div class="product-price">UGX ${Number(p.price).toLocaleString()}</div>
        <div class="product-location">📍 ${p.location || 'Uganda'}</div>
      </div>
    </div>
  `).join("");
}

window.scrollCarousel = function(index) {
  const carousel = document.getElementById("featured-carousel");
  const width = carousel.scrollWidth / featuredProducts.length;
  carousel.scrollLeft = width * index;
};

window.filterByCategory = function(category) {
  const filtered = allProducts.filter(p => p.category === category);
  const grid = document.getElementById("products-grid");

  grid.innerHTML = filtered
    .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
    .map(p => `
    <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="product-image">
        <img src="${p.images?.[0] || ''}" alt="${p.name}">
      </div>
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
        <div class="product-price">UGX ${Number(p.price).toLocaleString()}</div>
        <div class="product-location">📍 ${p.location || 'Uganda'}</div>
      </div>
    </div>
  `).join("");
};

window.filterByLocation = function(location) {
  const filtered = location ? 
    allProducts.filter(p => p.location === location) : 
    allProducts;

  const grid = document.getElementById("products-grid");
  grid.innerHTML = filtered
    .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
    .map(p => `
    <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="product-image">
        <img src="${p.images?.[0] || ''}" alt="${p.name}">
      </div>
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
        <div class="product-price">UGX ${Number(p.price).toLocaleString()}</div>
        <div class="product-location">📍 ${p.location || 'Uganda'}</div>
      </div>
    </div>
  `).join("");
};

window.performSearch = function() {
  const query = document.getElementById("search-bar").value.toLowerCase();
  if (!query) {
    renderProducts();
    return;
  }

  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.description?.toLowerCase().includes(query)
  );

  const grid = document.getElementById("products-grid");
  grid.innerHTML = filtered
    .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
    .map(p => `
    <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="product-image">
        <img src="${p.images?.[0] || ''}" alt="${p.name}">
      </div>
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
        <div class="product-price">UGX ${Number(p.price).toLocaleString()}</div>
        <div class="product-location">📍 ${p.location || 'Uganda'}</div>
      </div>
    </div>
  `).join("");
};

function updateAuthUI() {
  const postBtn = document.getElementById("post-ad-btn");
  const dashBtn = document.getElementById("dashboard-btn");
  const navPostBtn = document.getElementById("nav-post-btn");
  const navAcctBtn = document.getElementById("nav-account-btn");
  const fabBtn = document.getElementById("fab-post-btn");

  if (currentUser) {
    postBtn.style.display = "inline-block";
    dashBtn.style.display = "inline-block";
    navPostBtn.style.display = "flex";
    navAcctBtn.style.display = "flex";
    fabBtn.style.display = "flex";
  } else {
    postBtn.style.display = "none";
    dashBtn.style.display = "none";
    navPostBtn.style.display = "none";
    navAcctBtn.style.display = "none";
    fabBtn.style.display = "none";
  }
}

window.toggleMenu = function() {
  const menu = document.getElementById("header-actions");
  menu.classList.toggle("active");
};

window.openAdminLoginModal = function() {
  document.getElementById("admin-modal").classList.add("open");
  document.getElementById("overlay").classList.add("active");
};

window.closeAllModals = function() {
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("open"));
  document.getElementById("overlay").classList.remove("active");
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove("open");
  document.getElementById("overlay").classList.remove("active");
};

window.adminLogin = async function() {
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;

  if (email !== "swaibuziraye22@gmail.com") {
    alert("Admin access denied");
    return;
  }

  try {
    const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin-analytics.html";
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

window.goHome = function() {
  window.location.href = "index.html";
};

loadProducts();