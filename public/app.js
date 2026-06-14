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

// ── Save scroll position before leaving page ──
window.addEventListener("beforeunload", () => {
  sessionStorage.setItem("zibuy_scroll", window.scrollY);
});

// =============================
// GLOBAL STATE (ZiBuy SAFE FIX)
// =============================
let allProducts = [];
let filteredProducts = [];
// User + UI state
let currentUser = null;
let searchQuery = "";
let currentCategory = "all";
let currentSubcategory = "all";


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
  loadBannerAd();
  loadFeaturedShops();
}

  // ── Restore scroll position and category after back navigation ──
  const savedScroll   = sessionStorage.getItem("zibuy_scroll");
  const savedCategory = sessionStorage.getItem("zibuy_last_category");

  if (savedCategory && savedCategory !== "all") {
    // Re-apply last active category filter
    if (
  savedCategory &&
  savedCategory !== "all" &&
  typeof window.filterCategory === "function"
) {
  window.filterCategory(savedCategory);
}
    document.querySelectorAll(".cat-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.cat === savedCategory);
    });
  }

  if (savedScroll) {
    // Wait for products to render then scroll
    setTimeout(() => {
      window.scrollTo({ top: parseInt(savedScroll), behavior: "instant" });
      sessionStorage.removeItem("zibuy_scroll");
    }, 400);
  }

// Load banner ads from Firestore
async function loadBannerAd() {
  try {
    const snap = await getDocs(query(
      collection(db, "banner_ads"),
      where("active", "==", true)
    ));
    if (snap.empty) return;

    const banner = snap.docs[0].data();
    const slot = document.getElementById("top-banner-slot");
    if (!slot) return;

    slot.style.display = "block";
    slot.innerHTML = `
      <a href="${banner.url || '#'}" target="_blank"
        style="display:block;border-radius:12px;overflow:hidden;cursor:pointer">
        <img src="${banner.imageUrl}" alt="${banner.title || 'Ad'}"
          style="width:100%;height:auto;max-height:100px;object-fit:cover;border-radius:12px">
      </a>
    `;

    // Track impression
    const bannerDoc = snap.docs[0]; {
     import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
  .then(({ increment, updateDoc, doc }) => {
    updateDoc(doc(db, "banner_ads", bannerDoc.id), {
      impressions: increment(1)
    }).catch(() => {}); // silent — logged-out users can't write, that's ok
  }).catch(() => {});


    }
  } catch (e) {}
}



// ============================================
// ============================================
// AUTH STATE LISTENER
// ============================================

function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

// Auto-create user doc if missing (fixes old accounts)
    if (user) {
      import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
        .then(({ setDoc, doc, getDoc }) => {
          const ref = doc(db, "users", user.uid);
          getDoc(ref).then(snap => {
            if (!snap.exists()) {
              setDoc(ref, {
                email:            user.email,
                uid:              user.uid,
                plan:             "free",
                accountType:      "normal",
                isSellerVerified: false,
                banned:           false,
                createdAt:        new Date()
              });
            }
          });
        });
    }

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
   const isAdmin = user?.email === "swaibuziraye22@gmail.com";
    const elements = {
      "post-ad-btn":       user ? "block" : "none",
      "dashboard-btn":     user && !isAdmin ? "block" : "none",
      "upgrade-btn":       user && !isAdmin ? "block" : "none",
      "messages-btn":      user ? "block" : "none",
      "notifications-btn": user ? "block" : "none",
      "admin-panel-btn":   isAdmin ? "block" : "none"
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


function getTrendScore(p) {
  return (
    (p.views || 0) +
    ((p.likes || 0) * 3) +
    ((p.orders || 0) * 10)
  );
}

function isTrending(p) {
  return getTrendScore(p) > 50;
}


// ============================================
// LOAD PRODUCTS FROM FIRESTORE
// ============================================
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    // ── Batch load plans + verifications ONCE ──
    let planMap   = {};
    let verifSet  = new Set();
    let memberSinceMap = {};


    try {
      const [usersSnap, verifSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(
          collection(db, "seller_verifications"),
          where("status", "==", "approved")
        ))
      ]);

      // memberSinceMap stores join date per userId
      memberSinceMap = {};

      usersSnap.forEach(d => {
        const data = d.data();
        if (data.plan && data.plan !== "free") {
          planMap[d.id] = data.plan;
        }
       // Store member since — try createdAt, fall back to planUpdatedAt
        const rawDate = data.createdAt || data.planUpdatedAt || data.lastVerificationSubmit || null;
        if (rawDate) {
          const joinDate = rawDate?.toDate?.() || (rawDate instanceof Date ? rawDate : null);
          if (joinDate) {
            memberSinceMap[d.id] = joinDate.toLocaleDateString("en-UG", {
              month: "long", year: "numeric"
            });
          }
        }
       
      });

      verifSnap.forEach(d => verifSet.add(d.data().userId));
    } catch (e) {
      console.warn("Batch load skipped (guest mode):", e.code);
    }

    const products = snapshot.docs.map((docSnap) => {
        const product = {
          id: docSnap.id,
          ...docSnap.data()
        };

        // expires check
        if (product.expiresAt) {
          const expiryDate = product.expiresAt.toDate
            ? product.expiresAt.toDate()
            : new Date(product.expiresAt);
          if (expiryDate < new Date()) product.status = "expired";
        }

        // plan + verified from batch maps — zero extra reads
       product.shopPlan = planMap[product.userId] || "free";
        product.seller   = product.seller || {};
        product.seller.isVerified = verifSet.has(product.userId);
        product.sellerMemberSince = memberSinceMap[product.userId] || null;
        product.sellerIsVerified  = verifSet.has(product.userId);

        // Admin-posted ads = ZiBuy official + auto featured
        const isAdminPost = product.userEmail === "swaibuziraye22@gmail.com";
        product.isZiBuyOfficial = isAdminPost;
        if (isAdminPost) product.isPremium = true;

        const planScore      = PLAN_SCORE[product.shopPlan] || 1;
        const boostScore     = product.isPremium ? 5000 : 0;
        const verifScore     = product.seller.isVerified ? 500 : 0;
        const created        = product.createdAt?.toDate?.() || new Date();
        const freshnessScore = Math.max(0, 100 - (new Date() - created) / 3_600_000);

        // Admin posts always rank first — never overwrite with calculated score
        product.rankScore = isAdminPost
          ? 999999
          : (planScore * 1000) + boostScore + verifScore + freshnessScore;
       

        return product;
      });
  
 // Store all products globally for use in other functions
allProducts = products.sort((a, b) => b.rankScore - a.rankScore);

window.allProducts = allProducts;

// keep global sync (CRITICAL FIX)
window.allProducts = allProducts;

filteredProducts = [...allProducts];

// loadFeaturedProducts();
if (typeof window.renderProducts === "function") {
    window.renderProducts();
}

} catch (err) {
  console.error(err);


}
}

// ============================================
// FEATURED SHOPS (homepage)
// ============================================
async function loadFeaturedShops() {
  const section   = document.getElementById("featured-shops-section");
  const container = document.getElementById("featured-shops");
  if (!section || !container) return;

  try {
    const snap = await getDocs(query(
      collection(db, "shops"),
      where("plan", "in", ["gold", "silver"])
    ));

    if (snap.empty) {
      section.style.display = "none";
      return;
    }

    const shops = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.plan === "gold" ? 1 : 0) - (a.plan === "gold" ? 1 : 0))
      .slice(0, 10);

    section.style.display = "block";

    container.innerHTML = shops.map(s => `
      <div class="shop-card" onclick="window.location.href='shop.html?seller=${s.ownerId || s.id}'">
        <div class="shop-card-banner" style="${s.bannerUrl ? `background-image:url('${s.bannerUrl}')` : ""}">
          <img class="shop-card-logo" src="${s.logoUrl || 'https://via.placeholder.com/80?text=Zi'}" alt="${s.name || 'Shop'}">
        </div>
        <div class="shop-card-body">
          <h4>${s.name || "ZiBuy Shop"} ${s.isVerified ? "✅" : ""}</h4>
          <p class="shop-card-loc">📍 ${s.location || "Uganda"}</p>
          <span class="shop-card-plan plan-${s.plan}">${s.plan === "gold" ? "🥇 Gold Seller" : "🥈 Silver Seller"}</span>
        </div>
      </div>
    `).join("");

  } catch (e) {
    console.error("loadFeaturedShops error:", e);
    section.style.display = "none";
  }
}


// ============================================
// LOAD FEATURED PRODUCTS
// ============================================

async function loadFeaturedProducts() {
  try {
    const featured = await getFeaturedAds();

    console.log("Featured Ads:", featured);

    const container = document.getElementById("products");

    if (!container || featured.length === 0) return;

    const featuredHtml = `
      <div style="grid-column:1/-1;background:linear-gradient(135deg, #fff4ee, #fffbeb);border:2px solid #ff6600;border-radius:14px;padding:20px;margin-bottom:20px">
        <h2 style="margin:0 0 16px;color:#ff6600;font-size:16px;font-weight:800">⭐ FEATURED ADS</h2>
        <div class="product-row">
          ${featured.slice(0, 6).map(p => {
            // Get product details
            const product = allProducts.find(ap => ap.id === p.productId);
            if (!product) return "";

            const phone = (product.seller?.phone || "").replace(/\D/g, "");
            const hasPhone = phone.length > 0;

            return `
             <div class="product-card" style="
  position:relative;
  flex:0 0 auto;
  width:160px;
  min-width:160px;
">
                <div class="product-image-box">
                  <img src="${product.images?.[0] || ''}" alt="${product.name}">
                  <span class="premium-badge">⭐ FEATURED</span>
                </div>
                <div class="product-info">
                  <p class="product-cat">${product.category}</p>
                  <h3 class="product-title">${product.name}</h3>
                  <p class="product-price">UGX ${Number(product.price).toLocaleString()}</p>
                  <div style="margin-bottom:6px">
                    ${product.sellerIsVerified
                      ? `<span style="display:inline-block;background:#10b981;color:white;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:800">✅ Verified</span>`
                      : ""}
                    ${p.sellerMemberSince
              ? `<p style="color:#6b7280;font-size:10px;margin:0;font-weight:600">🗓️ ${p.sellerMemberSince}</p>`
              : ""}
                  </div>
                  <div class="card-footer">
                    <button class="cart-btn"
                      onclick="window.location.href='product.html?id=${product.id}'"
                      style="font-size:11px;flex:1">
                      View Ad
                    </button>
                    ${hasPhone ? `
                      <button class="view-btn"
                        onclick="messageWhatsApp('${phone}','${product.name}',${product.price})"
                        style="font-size:11px;background:#25d366;color:white;border:none">
                        💬
                      </button>` : ""}
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

  const views = Number(product.views || 0);
  const likes = Number(product.likes || 0);
  const orders = Number(product.orders || 0);

  // ── BASE SCORE ─────────────────
  let score = 0;

  // ── PREMIUM BOOST ─────────────
  if (product.isPremium) {
    score += 1000;
  }

  // ── SHOP PLAN BOOST (VERY IMPORTANT) ─────────────
  const plan = (product.shopPlan || "free").toLowerCase();

  switch (plan) {
    case "gold":
      score += 800;
      break;

    case "silver":
      score += 500;
      break;

    case "bronze":
      score += 250;
      break;

    default:
      score += 50;
  }

  // ── VERIFIED SELLER ─────────────
  if (product.seller?.isVerified) {
    score += 120;
  }

  // ── ENGAGEMENT (TIKTOK STYLE) ───
  score += (views * 1);
  score += (likes * 4);
  score += (orders * 12);

  // ── FINAL RETURN ───────────────
  return score;
}

// ============================================
// RENDER PRODUCTS (FIXED SAFE VERSION)
// ============================================
window.renderProducts = function () {

  const container = document.getElementById("products");
  if (!container) return;

  if (!Array.isArray(allProducts)) {
    console.warn("allProducts is not ready");
    return;
  }

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
      ${p.subcategory || ""}
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

    default:
      products.sort((a, b) => {

        const aBoost = (a.boost?.active || a.isPremium) ? 1 : 0;
        const bBoost = (b.boost?.active || b.isPremium) ? 1 : 0;

        if (aBoost !== bBoost) return bBoost - aBoost;

        const aTime = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt || 0).getTime();

        const bTime = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt || 0).getTime();

        return bTime - aTime;
      });
  }

  filteredProducts = products;

  // =========================
  // BOOST MIX SYSTEM
  // =========================
  const boostedProducts = products.filter(p => p.boost?.active || p.isPremium);
  const normalProducts = products.filter(p => !p.boost?.active && !p.isPremium);

  const mixedProducts = [];
  let boostIndex = 0;
  let normalIndex = 0;

  while (boostIndex < boostedProducts.length || normalIndex < normalProducts.length) {

    if (boostIndex < boostedProducts.length) {
      mixedProducts.push(boostedProducts[boostIndex]);
      boostIndex++;
    }

    for (let i = 0; i < 4; i++) {
      if (normalIndex < normalProducts.length) {
        mixedProducts.push(normalProducts[normalIndex]);
        normalIndex++;
      }
    }
  }

  products = mixedProducts;

  if (typeof buildCategoryNav === "function") {
    buildCategoryNav(products);
  }

  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:#666;">
        No products found 😕
      </div>
    `;
    return;
  }

  const grouped = {};
  const trending = [];
  const newArrivals = [];
  const featured = [];
  const sponsored = [];

  const now = Date.now();

  function getPlanScore(plan) {
    return PLAN_SCORE[plan || "free"] || 1;
  }

  function getTrendingScore(p, plan) {

    const views = Number(p.views || 0);
    const likes = Number(p.likes || 0);
    const orders = Number(p.orders || 0);

    const created = p.createdAt?.toDate
      ? p.createdAt.toDate().getTime()
      : new Date(p.createdAt || 0).getTime();

    const hoursOld = Math.max(1, (Date.now() - created) / 36e5);

    const planBoost = getPlanScore(plan) * 100;

    const engagement =
      (likes * 3) +
      (orders * 10) +
      (views * 1);

    const decay = Math.max(0.3, 1 - (hoursOld / 72));

    const velocity = (likes + orders) / hoursOld;

    return (planBoost + engagement) * decay + (velocity * 5);
  }

  products.forEach(p => {

    p.views = Number(p.views || 0);
    p.likes = Number(p.likes || 0);
    p.orders = Number(p.orders || 0);

    const cat = (p.category || "Others").toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);

    if (p.boost?.active || p.isPremium) {
      sponsored.push(p);
      featured.push(p);
    }

    const created = p.createdAt?.toDate
      ? p.createdAt.toDate().getTime()
      : new Date(p.createdAt || 0).getTime();

    if (now - created <= 7 * 86400000) {
      newArrivals.push(p);
    }

    const plan = p.plan || "free";
    const score = getTrendingScore(p, plan);

    p.score = score;


    trending.push(p);

  });


  trending.sort((a, b) => b.score - a.score);

const topTrending = trending.slice(0, 10);

  function renderRow(title, list) {

    if (!Array.isArray(list) || list.length === 0) return;

    const section = document.createElement("div");
    section.className = "product-section";

    section.innerHTML = `
      <h2 style="margin:10px;">${title}</h2>
      <div class="product-row"></div>
    `;

    const row = section.querySelector(".product-row");

    row.style.display = "flex";
    row.style.overflowX = "auto";
    row.style.gap = "10px";
    row.style.padding = "10px";
    row.style.scrollSnapType = "x mandatory";

    let index = 0;
    const batchSize = 8;

    function loadMore() {

      const slice = list.slice(index, index + batchSize);

      slice.forEach(p => {

        const card = document.createElement("div");
        card.className = "product-card";

        card.style.flex = "0 0 auto";
        card.style.minWidth = "160px";
        card.style.background = "#fff";
        card.style.borderRadius = "6px";
        card.style.overflow = "hidden";
        card.style.boxShadow = "0 1px 4px rgba(0,0,0,0.10)";
        card.style.scrollSnapAlign = "start";
        card.style.cursor = "pointer";

        const isTrending = topTrending.some(t => t.id === p.id);

        card.innerHTML = `
          <div style="position:relative;background:#f7f7f7;">
            <img src="${(p.images && p.images[0]) || 'placeholder.jpg'}"
              style="width:100%; aspect-ratio:1/1; object-fit:cover;">

          ${p.isZiBuyOfficial ? `
              <div style="position:absolute;top:5px;left:5px;background:linear-gradient(135deg,#111827,#374151);color:white;font-size:10px;padding:3px 8px;border-radius:5px;font-weight:800;display:flex;align-items:center;gap:3px">
                <img src="my_logo.png" style="width:12px;height:12px;object-fit:contain;border-radius:2px"> ZiBuy
              </div>
            ` : isTrending ? `
              <div style="position:absolute;top:5px;left:5px;background:#ff6600;color:white;font-size:10px;padding:3px 6px;border-radius:5px;font-weight:800">
                🔥 TRENDING
              </div>
            ` : ""}
            ${p.isPremium && !p.isZiBuyOfficial ? `
              <div style="position:absolute;top:5px;right:5px;background:linear-gradient(135deg,#ff6600,#ff9900);color:white;font-size:10px;padding:3px 6px;border-radius:5px;font-weight:800">
                ⭐ Featured
              </div>
            ` : ""}  
          </div>

          <div style="padding:6px;">
            <h3 style="font-size:12px;margin:0;">
              ${p.name || "No name"}
            </h3>

            <p style="color:#f68b1e;font-weight:700;margin:4px 0;">
              UGX ${Number(p.price || 0).toLocaleString()}
            </p>

            <button onclick="event.stopPropagation();window.location.href='product.html?id=${p.id}'"
              style="width:100%;padding:6px;font-size:11px;background:#f68b1e;color:white;border:none;">
              View
            </button>

      <div style="margin-top:4px">
            <p class="location"
              style="color:#999;font-size:11px;margin:0 0 2px;cursor:pointer"
              onclick="event.stopPropagation();window.location.href='user-profile.html?id=${p.userId}'">
              📍 ${p.location || "Unknown"}
            </p>
            ${p.sellerIsVerified
              ? `<span style="display:inline-block;background:#10b981;color:white;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:800;margin-bottom:2px">✅ Verified</span>`
              : ""}
            ${p.sellerMemberSince
              ? `<p style="color:#adb5bd;font-size:10px;margin:0">🗓️ Since ${p.sellerMemberSince}</p>`
              : ""}
          </div>

          </div>
        `;

        row.appendChild(card);
      });

      index += batchSize;
    }

    loadMore();

    row.addEventListener("scroll", () => {
      if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 50) {
        loadMore();
      }
    });

    container.appendChild(section);
  }
  
  renderRow("🔥 Trending", topTrending);
  renderRow("🆕 New Arrivals", newArrivals);

  Object.keys(grouped).forEach(cat => {
    renderRow(cat.charAt(0).toUpperCase() + cat.slice(1), grouped[cat]);
  });
};
 
 
// ============================================
// LOAD JOB ADS (seeking-work category)
// ============================================
async function loadJobAds() {
  const container = document.getElementById("products");
  if (!container) return;

  try {
    const snap = await getDocs(query(
      collection(db, "job_ads"),
      where("status", "==", "active")
    ));

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💼</div>
          <p>No job listings yet</p>
          <p style="font-size:13px;margin-top:8px">
            <a href="hiring.html" style="color:#ff6600;font-weight:700">
              Post a job →
            </a>
          </p>
        </div>`;
      return;
    }

    // Sort: top ads first, then by date
    const jobs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if (a.isTop && !b.isTop) return -1;
        if (!a.isTop && b.isTop)  return  1;
        return (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0);
      });

    container.innerHTML = jobs.map(job => {
      const deadline = job.deadline
        ? new Date(job.deadline).toLocaleDateString("en-UG", { day:"numeric", month:"short" })
        : "Open";

      const daysAgo = job.createdAt?.toDate?.()
        ? Math.floor((new Date() - job.createdAt.toDate()) / 86400000)
        : 0;

      return `
        <div onclick="window.location.href='job.html?id=${job.id}'"
          style="background:white;border-radius:14px;padding:18px;
          box-shadow:0 2px 12px rgba(0,0,0,0.07);cursor:pointer;
          border-left:4px solid ${job.isTop ? "#ff6600" : "#1e40af"};
          transition:.2s;grid-column:1/-1"
          onmouseover="this.style.transform='translateX(4px)'"
          onmouseout="this.style.transform='translateX(0)'">

          <div style="display:flex;align-items:flex-start;
            justify-content:space-between;gap:12px;flex-wrap:wrap">

            <div style="flex:1;min-width:0">
              <!-- Badges -->
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                ${job.isTop ? `
                  <span style="background:#ff6600;color:white;padding:3px 10px;
                    border-radius:20px;font-size:11px;font-weight:800">
                    ⭐ TOP AD
                  </span>` : ""}
                <span style="background:#dbeafe;color:#1e40af;padding:3px 10px;
                  border-radius:20px;font-size:11px;font-weight:800">
                  💼 WE ARE HIRING
                </span>
                <span style="background:#f3f4f6;color:#374151;padding:3px 10px;
                  border-radius:20px;font-size:11px;font-weight:700">
                  ${job.type || "Full Time"}
                </span>
              </div>

              <!-- Title -->
              <h3 style="margin:0 0 4px;font-size:16px;font-weight:800;
                color:#111827;line-height:1.3">
                ${job.title}
              </h3>

              <!-- Company -->
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#ff6600">
                🏢 ${job.company}
              </p>

              <!-- Meta -->
              <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#6b7280">
                <span>📍 ${job.location}</span>
                <span>💰 ${job.salary}</span>
                <span>🗂️ ${job.category}</span>
              </div>
            </div>

            <!-- Right side -->
            <div style="text-align:right;flex-shrink:0">
              <p style="margin:0 0 6px;font-size:11px;color:#9ca3af">
                ${daysAgo === 0 ? "Today" : daysAgo + "d ago"}
              </p>
              <p style="margin:0;font-size:11px;color:#6b7280">
                Deadline: <strong>${deadline}</strong>
              </p>
              <div style="margin-top:10px;background:#ff6600;color:white;
                padding:8px 16px;border-radius:8px;font-size:12px;font-weight:800">
                View Job →
              </div>
            </div>

          </div>

          <!-- Description preview -->
          <p style="margin:10px 0 0;font-size:13px;color:#6b7280;
            line-height:1.6;overflow:hidden;display:-webkit-box;
            -webkit-line-clamp:2;-webkit-box-orient:vertical">
            ${job.desc || ""}
          </p>

        </div>`;
    }).join("");

    // Make grid single-column for job cards
    container.style.gridTemplateColumns = "1fr";

  } catch(e) {
    console.error("loadJobAds error:", e);
  }
}


// ============================================
// CATEGORY FILTER
// ============================================

window.filterCategory = function(category, el) {
  sessionStorage.setItem("zibuy_last_category", category);

// Job ads use a different collection
  if (category === "seeking-work") {
    document.querySelectorAll(".cat-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.cat === category)
    );
    loadJobAds();
    return;
  }


  currentCategory = category;
  currentSubcategory = "all";

  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  if (el) el.classList.add("active");

  renderProducts();



window.openSellerShop = function(userId) {

  window.location.href =
    `shop.html?seller=${userId}`;

};

};

window.filterSubcategory = function(subcat) {
  currentSubcategory = subcat;
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

  // Save cart session for abandoned cart emails
  if (currentUser) {
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
      .then(({ doc, setDoc }) => {
        setDoc(doc(db, "cart_sessions", currentUser.uid), {
          userEmail: currentUser.email,
          items:     JSON.parse(localStorage.getItem("zibuy-cart") || "[]"),
          status:    "active",
          updatedAt: new Date()
        });
      }).catch(() => {});
  }
};


// Save cart session to Firestore for abandoned cart emails
window.updateCartUI = function () {

}


window.updateCartUI = function () {
  const cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  const el = document.getElementById("cart-count");
  if (el) el.textContent = count;
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
      adminClickCount = 0;
      const user = auth.currentUser;
      if (user && user.email === "swaibuziraye22@gmail.com") {
        window.location.href = "admin.html";
      } else {
        alert("Admin access denied.");
      }
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

// ============================================
// BUILD CATEGORY NAV BAR
// ============================================
function buildCategoryNav(products) {
  const nav = document.getElementById("category-nav");
  if (!nav) return;

  const cats = ["all", ...new Set(products.map(p => p.category || "others"))];

  nav.innerHTML = "";

  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);

    btn.classList.toggle("active", currentCategory === cat);

    btn.onclick = () => {
      currentCategory = cat;
      currentSubcategory = "all"; // RESET subcategory when category changes
      renderProducts();
    };

    nav.appendChild(btn);
  });

  // OPTIONAL: show subcategories for selected category
  const subcats = [
    "all",
    ...new Set(
      products
        .filter(p => currentCategory === "all" || p.category === currentCategory)
        .map(p => p.subcategory || "others")
    )
  ];

  const subNav = document.getElementById("subcategory-nav");
  if (!subNav) return;

  subNav.innerHTML = "";

  subcats.forEach(sc => {
    const btn = document.createElement("button");
    btn.innerText = sc;

    btn.classList.toggle("active", currentSubcategory === sc);

    btn.onclick = () => {
      currentSubcategory = sc;
      renderProducts();
    };

    subNav.appendChild(btn);
  });
}


let deferredPrompt;

// Capture install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // show install UI
  document.getElementById("installBtn").style.display = "block";
  document.getElementById("installBanner").style.display = "flex";
});

// Install button click
window.installZiBuy = function() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  deferredPrompt.userChoice.then((choice) => {
    if (choice.outcome === "accepted") {
      console.log("User installed ZiBuy");
    }
    deferredPrompt = null;
  });
}


window.addEventListener("appinstalled", () => {
  console.log("ZiBuy installed successfully");
  document.getElementById("installBtn").style.display = "none";
  document.getElementById("installBanner").style.display = "none";
});


function showSection(sectionId) {
  const sections = document.querySelectorAll(".page");

  sections.forEach((sec) => {
    sec.classList.remove("active");
  });

  document.getElementById(sectionId).classList.add("active");

  window.scrollTo(0, 0);
}

window.showSection = showSection;


if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg =
        await navigator.serviceWorker.register("/service-worker.js");

      console.log("SW registered:", reg.scope);

      if (reg.waiting) {
        reg.waiting.postMessage({
          type: "SKIP_WAITING"
        });
      }

    } catch (err) {
      console.error(err);
    }
  });
}


// ============================================
// PASSWORD TOGGLE
// ============================================
window.togglePasswordView = function(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input) return;
  if (input.type === "password") {
    input.type  = "text";
    if (btn) btn.textContent = "🙈";
  } else {
    input.type  = "password";
    if (btn) btn.textContent = "👁️";
  }
};

// ============================================
// TOGGLE REGISTER VIEW
// ============================================
window.toggleRegister = function(showRegister) {
  document.getElementById("register-section").style.display  = showRegister ? "block" : "none";
  document.getElementById("login-actions").style.display     = showRegister ? "none"  : "block";
};

// ============================================
// CHANGE PASSWORD SECTION
// ============================================
window.openChangePassword = function() {
  document.getElementById("change-password-section").style.display = "block";
};

window.closeChangePassword = function() {
  document.getElementById("change-password-section").style.display = "none";
  const f = document.getElementById("new-password");
  if (f) f.value = "";
};

window.changeUserPassword = async function() {
  const { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

  const newPass = document.getElementById("new-password")?.value.trim();
  if (!newPass || newPass.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  const user = auth.currentUser;
  if (!user) { alert("You must be logged in"); return; }

  try {
    await updatePassword(user, newPass);
    alert("✅ Password updated successfully!");
    closeChangePassword();
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      alert("⚠️ Please log out and log in again before changing your password.");
    } else {
      alert("❌ " + err.message);
    }
  }
};

window.sendPasswordReset = async function() {
  const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

  const email = document.getElementById("auth-email")?.value.trim()
    || auth.currentUser?.email;

  if (!email) {
    alert("Enter your email address in the Email field first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert(`✅ Password reset link sent to ${email}. Check your inbox.`);
    closeAuthModal();
  } catch (err) {
    alert("❌ " + err.message);
  }
};

// ============================================
// UPDATE customerRegister to use new fields
// ============================================
window.customerRegister = async function() {
  const { createUserWithEmailAndPassword } =
    await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const { setDoc, doc } =
    await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const emailEl   = document.getElementById("reg-email")   || document.getElementById("auth-email");
  const passEl    = document.getElementById("reg-password") || document.getElementById("auth-password");
  const confirmEl = document.getElementById("reg-confirm");

  const email    = emailEl?.value.trim();
  const password = passEl?.value.trim();
  const confirm  = confirmEl?.value.trim();

 if (!email || !password) { alert("Enter email and password"); return; }
  if (confirm && password !== confirm) { alert("Passwords do not match"); return; }
  if (password.length < 6) { alert("Password must be at least 6 characters"); return; }

  const agreeTerms = document.getElementById("agree-terms");
  if (agreeTerms && !agreeTerms.checked) {
    agreeTerms.style.outline = "2px solid #ef4444";
    agreeTerms.parentElement.style.color = "#ef4444";
    agreeTerms.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      agreeTerms.style.outline = "";
      agreeTerms.parentElement.style.color = "#374151";
    }, 3000);
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // ✅ Save to Firestore users collection
    await setDoc(doc(db, "users", user.uid), {
      email:          user.email,
      uid:            user.uid,
      plan:           "free",
      accountType:    "normal",
      isSellerVerified: false,
      banned:         false,
      createdAt:      new Date()
    });

    alert("✅ Account created! You're now logged in.");
    closeAuthModal();
  } catch (err) {
    alert("❌ " + err.message);
  }
};


