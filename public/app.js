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


import { captureReferralCode, ensureReferralCode } from "./referral.js";
captureReferralCode(); // runs immediately on every page load

import { getDistricts, getSubLocations } from "./uganda-locations.js";

function categoryEmoji(cat) {
  const map = {
    phones: "📱",
    electronics: "💻",
    fashion: "👗",
    shoes: "👟",
    beauty: "💄",
    bags: "👜",
    groceries: "🛒",
    watches: "⌚",
    computers: "🖥️",
    gaming: "🎮",
    home: "🏠",
    accessories: "💎",
    vehicles: "🚗",
    animals: "🐾",
    babies: "👶",
    agriculture: "🌾",
    commercial: "🏗️",
    tours: "✈️",
    "seeking-work": "💼",
    services: "🔧",
    "repair-construction": "🔨",
    property: "🏘️",
    "phone-accessories": "🔌"
  };

  return map[cat] || "📋";
}

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

// ── Infinite scroll ──
let displayedCount = 0;
const PAGE_SIZE = 20;
let isLoadingMore = false;

// Infinite scroll grid state
let _pagedProducts = [];
let _pageIndex = 0;
let _isLoadingMore = false;

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

   // Always start at top of page
  window.scrollTo({ top: 0, behavior: "instant" });
  sessionStorage.removeItem("zibuy_scroll");

  setupAuthStateListener();
  
  loadProducts();

  // Defer non-critical loads until after products render
  setTimeout(() => {

  loadBannerAd();
  populateFilterDistricts();
  loadFeaturedShops();
  loadCategorySponsors();
  
  }, 800);


  // ── Restore scroll position and category after back navigation ──
  const savedScroll   = sessionStorage.getItem("zibuy_scroll");
  const savedCategory = sessionStorage.getItem("zibuy_last_category");

  if (savedCategory && savedCategory !== "all") {
    setTimeout(() => {
      if (typeof filterCategory === "function") {
        filterCategory(savedCategory);
        document.querySelectorAll(".cat-btn").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.cat === savedCategory);
        });
      }
    }, 500);
  }

  if (savedScroll) {
    setTimeout(() => {
      window.scrollTo({ top: parseInt(savedScroll), behavior: "instant" });
      sessionStorage.removeItem("zibuy_scroll");
    }, 600);
  }
} // ← closes initApp

// Load banner ads from Firestore — rotates if multiple
async function loadBannerAd() {
  try {
    const snap = await getDocs(query(
      collection(db, "banner_ads"),
      where("active", "==", true)
    ));
    if (snap.empty) return;

    const banners = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const slot = document.getElementById("top-banner-slot");
    if (!slot) return;

    slot.style.display = "block";

    // Build all banner slides + dots
    slot.innerHTML = `
      <div style="position:relative;border-radius:12px;overflow:hidden">
        <div id="banner-slides" style="position:relative;height:220px">
          ${banners.map((b, i) => `
            <a href="${b.url || '#'}" target="_blank" data-banner-idx="${i}"
              style="position:absolute;inset:0;display:block;opacity:${i === 0 ? 1 : 0};
              transition:opacity .6s ease;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 20px rgba(0,0,0,0.15)">
              <img src="${b.imageUrl}" alt="${b.title || 'Ad'}"
                style="width:100%;height:220px;object-fit:cover;border-radius:16px">
              ${b.title ? `
                <div style="position:absolute;bottom:0;left:0;right:0;
                  background:linear-gradient(transparent,rgba(0,0,0,0.6));
                  padding:20px 16px 14px;border-radius:0 0 16px 16px">
                  <p style="margin:0;color:white;font-weight:800;font-size:15px">
                    ${b.title}
                  </p>
                  ${b.subtitle ? `<p style="margin:3px 0 0;color:rgba(255,255,255,.8);font-size:12px">${b.subtitle}</p>` : ""}
                </div>` : ""}
            </a>
          `).join("")}
        </div>
        ${banners.length > 1 ? `
          <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
            display:flex;gap:6px;z-index:5">
            ${banners.map((_, i) => `
              <span class="banner-dot" data-dot-idx="${i}"
                style="width:7px;height:7px;border-radius:50%;
                background:${i === 0 ? '#ff6600' : 'rgba(255,255,255,.6)'};
                box-shadow:0 1px 3px rgba(0,0,0,.3);transition:.3s"></span>
            `).join("")}
          </div>` : ""}
      </div>
    `;

    // Track impression for first banner shown
    trackBannerImpression(banners[0].id);

    // Rotate if more than 1 banner
    if (banners.length > 1) {
      let current = 0;
      setInterval(() => {
        const slides = slot.querySelectorAll("[data-banner-idx]");
        const dots   = slot.querySelectorAll(".banner-dot");

        slides[current].style.opacity = "0";
        dots[current].style.background = "rgba(255,255,255,.4)";

        current = (current + 1) % banners.length;

        slides[current].style.opacity = "1";
        dots[current].style.background = "white";

        trackBannerImpression(banners[current].id);
      }, 4000); // changes every 4 seconds
    }

  } catch (e) { console.warn("loadBannerAd:", e.message); }
}

function trackBannerImpression(bannerId) {
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
    .then(({ increment, updateDoc, doc }) => {
      updateDoc(doc(db, "banner_ads", bannerId), {
        impressions: increment(1)
      }).catch(() => {});
    }).catch(() => {});
}

// ── Populate filter district dropdown ──────────
async function populateFilterDistricts() {
  const { getDistricts, getSubLocations } = await import("./uganda-locations.js");

  // Store for use by updateFilterSubLocations
  window._getSubLocations = getSubLocations;

  const el = document.getElementById("filter-location");
  if (!el) return;

  getDistricts().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    el.appendChild(opt);
  });
}

window.updateFilterSubLocations = function() {
  const district = document.getElementById("filter-location")?.value;
  const wrap     = document.getElementById("filter-sublocation-wrap");
  const subEl    = document.getElementById("filter-sublocation");
  if (!wrap || !subEl) return;

  if (!district || !window._getSubLocations) {
    wrap.style.display = "none";
    return;
  }

  const subs = window._getSubLocations(district);
  subEl.innerHTML = `<option value="">All Areas in ${district}</option>` +
    subs.map(s => `<option value="${s}">${s}</option>`).join("");
  wrap.style.display = "block";
};


// ============================================
// ============================================
// AUTH STATE LISTENER
// ============================================

function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

// Auto-create user doc if missing (fixes old accounts)
    if (user) {
      // Ensure referral code exists for every logged-in user
      ensureReferralCode(user.uid);

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
      "admin-panel-btn":   isAdmin ? "block" : "none",
      "go-admin-btn":      isAdmin ? "flex"  : "none"
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

    // Load unread notification count
    if (user) {
      loadUnreadNotifCount(user.uid);
    } else {
      const badge = document.getElementById("notif-count");
      if (badge) badge.style.display = "none";
    }
  });
}

async function loadUnreadNotifCount(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      where("read", "==", false)
    ));
    const badge = document.getElementById("notif-count");
    if (!badge) return;

    if (snap.size > 0) {
      badge.textContent = snap.size > 9 ? "9+" : snap.size;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  } catch (e) {
    console.warn("loadUnreadNotifCount:", e.message);
  }
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
  // ── Use cached data if available and fresh (under 2 minutes old) ──
  const cached = sessionStorage.getItem("zibuy_products_cache");
  const cachedAt = sessionStorage.getItem("zibuy_products_cache_time");

  if (cached && cachedAt && (Date.now() - parseInt(cachedAt)) < 120000) {
    try {
      allProducts = JSON.parse(cached);
      window.allProducts = allProducts;
      filteredProducts = [...allProducts];
      window.renderProducts();
      loadBuyPowerSection(allProducts);
      return; // skip Firestore fetch entirely — instant render
    } catch (e) {
      // cache corrupted, fall through to fresh fetch
    }
  }

  // Show skeleton cards immediately so page feels instant
  const container = document.getElementById("products");
  if (container) {
    container.innerHTML = `
      <div style="padding:10px">
        <div style="height:22px;width:140px;border-radius:6px;margin-bottom:12px;
          background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
          background-size:200% 100%;animation:shimmer 1.5s infinite"></div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          ${Array(6).fill(0).map(() => `
            <div style="border-radius:12px;overflow:hidden;background:white;
              box-shadow:0 1px 4px rgba(0,0,0,0.08)">
              <div style="aspect-ratio:1/1;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
                background-size:200% 100%;animation:shimmer 1.5s infinite"></div>
              <div style="padding:10px">
                <div style="height:10px;border-radius:4px;margin-bottom:8px;width:60%;
                  background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
                  background-size:200% 100%;animation:shimmer 1.5s infinite"></div>
                <div style="height:14px;border-radius:4px;margin-bottom:8px;width:80%;
                  background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
                  background-size:200% 100%;animation:shimmer 1.5s infinite"></div>
                <div style="height:28px;border-radius:7px;
                  background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
                  background-size:200% 100%;animation:shimmer 1.5s infinite"></div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  try {
    // ── Fire ALL queries in parallel — don't wait for one then another ──
    let planMap        = {};
    let verifSet       = new Set();
    let memberSinceMap = {};

    const [snapshot, usersSnap, verifSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "users")).catch(() => ({ docs: [] })),
      getDocs(query(
        collection(db, "seller_verifications"),
        where("status", "==", "approved")
      )).catch(() => ({ docs: [] }))
    ]);

    try {

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

filteredProducts = [...allProducts];

// Cache for instant back-navigation
try {
  sessionStorage.setItem("zibuy_products_cache", JSON.stringify(allProducts));
  sessionStorage.setItem("zibuy_products_cache_time", Date.now().toString());
} catch (e) {
  // storage full or unavailable — not critical, continue
}

// loadFeaturedProducts();
window.renderProducts();
loadBuyPowerSection(allProducts);

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
          <img class="shop-card-logo" src="${s.logoUrl || 'https://zibuy-5deae.web.app/icons/icon-512.png/80?text=Zi'}" alt="${s.name || 'Shop'}">
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
// BUY POWER — Best Secondhand Deals Section
// ============================================
async function loadBuyPowerSection(allProducts) {
  const section = document.getElementById("buy-power-section");
  const grid    = document.getElementById("buy-power-grid");
  if (!section || !grid) return;

  // Priority categories — phones and electronics first, then everything else
  const priorityCats = ["phones", "electronics", "computers", "gaming", "accessories"];

  const usedProducts = allProducts;

  if (usedProducts.length === 0) {
    section.style.display = "none";
    return;
  }

  // Sort: priority categories first, then by views descending
  usedProducts.sort((a, b) => {
    const aPriority = priorityCats.includes(a.category) ? 0 : 1;
    const bPriority = priorityCats.includes(b.category) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.views || 0) - (a.views || 0);
  });

  // Show max 12 products
  const toShow = usedProducts.slice(0, 12);

  section.style.display = "block";

  // Render as horizontal scroll row
grid.style.display = "flex";
grid.style.flexWrap = "nowrap";
grid.style.overflowX = "auto";
grid.style.gap = "10px";
grid.style.padding = "10px";
grid.style.scrollSnapType = "x mandatory";
grid.style.webkitOverflowScrolling = "touch";

  grid.innerHTML = toShow.map(p => {
    const img   = p.images?.[0] || "";
    const price = Number(p.price || 0).toLocaleString();
    const condition = (
      p.condition ||
      p.details?.condition ||
      p.details?.["cf-condition"] ||
      "Used"
    );

    return `
      <div onclick="window.location.href='product.html?id=${p.id}'"
style="
flex:0 0 auto;
width:180px;
background:white;
border-radius:12px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,0.06);
cursor:pointer;
transition:transform .2s,box-shadow .2s;
position:relative;
scroll-snap-align:start;
"
        ${(() => {

const c = (
  p.condition ||
  p.details?.condition ||
  p.details?.["cf-condition"] ||
  p.details?.["cf-phone-condition"] ||
  ""
).toLowerCase().trim();

let badge = "";
let color = "#6b7280";

if (c.includes("brand")) {
  badge = "🆕 BRAND NEW";
  color = "#16a34a";
}
else if (c.includes("refurb")) {
  badge = "♻️ REFURBISHED";
  color = "#2563eb";
}
else if (c.includes("foreign")) {
  badge = "🌍 FOREIGN USED";
  color = "#ff6600";
}
else if (c.includes("local")) {
  badge = "📦 LOCAL USED";
  color = "#ea580c";
}
else if (c.includes("used")) {
  badge = "⚡ USED";
  color = "#d97706";
}

return `
<!-- Save / Wishlist -->
<button onclick="event.stopPropagation();toggleLike('${p.id}',this)"
style="
position:absolute;
top:8px;
right:8px;
z-index:20;
background:white;
border:none;
width:30px;
height:30px;
border-radius:50%;
font-size:15px;
cursor:pointer;
display:flex;
align-items:center;
justify-content:center;
box-shadow:0 2px 8px rgba(0,0,0,.18);
">
🤍
</button>

${badge ? `
<div style="
position:absolute;
bottom:8px;
right:8px;
z-index:19;
background:${color};
color:white;
padding:4px 8px;
border-radius:6px;
font-size:10px;
font-weight:800;
line-height:1;
box-shadow:0 2px 6px rgba(0,0,0,.18);
pointer-events:none;
">
${badge}
</div>
` : ""}
`;

})()}

<img src="${img}" alt="${p.name}"
onerror="this.src='https://zibuy-5deae.web.app/icons/icon-512.png/200?text=No+Image'"
style="width:100%;height:150px;object-fit:cover">

        <div style="padding:10px">
          <p style="margin:0 0 4px;font-size:11px;color:#ff6600;
            font-weight:800;text-transform:uppercase;letter-spacing:.4px">
            ${p.category || ""}
          </p>
          <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#111827;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${p.name}
          </p>
          <p style="margin:0 0 4px;color:#ff6600;font-weight:900;font-size:15px">
            UGX ${price}
          </p>
          <p style="margin:0;font-size:11px;color:#9ca3af">
            📍 ${p.seller?.location || p.location || "Uganda"} · ${condition}
          </p>
        </div>
      </div>
    `;
  }).join("");
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
  // 1.5 SUBCATEGORY FILTER
  // =========================
  if (currentSubcategory && currentSubcategory !== "all") {
    products = products.filter(p =>
      (p.subcategory || "").toLowerCase() === currentSubcategory.toLowerCase()
    );
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
const usedProducts = [];
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


    // Buy Power products (formerly Used Products)

const condition = (
  p.condition ||
  p.details?.condition ||
  ""
).toLowerCase().trim();

const isUsed =
  condition.includes("used") ||
  condition.includes("foreign") ||
  condition.includes("local") ||
  condition.includes("refurbished");

if (isUsed) {
  usedProducts.push(p);

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

loadBuyPowerSection(usedProducts);

  // ── Infinite scroll grid (below Trending & New Arrivals) ──
  const allSection = document.createElement("div");
  allSection.id = "all-products-section";
  allSection.innerHTML = `
    <h2 style="margin:10px 10px 6px">
      🏪 All Listings
      <span id="all-products-count"
        style="font-size:13px;font-weight:600;color:#9ca3af;margin-left:8px">
        (${products.length})
      </span>
    </h2>
    <div id="all-products-grid"
      style="display:grid;grid-template-columns:repeat(2,1fr);
      gap:10px;padding:10px">
    </div>
    <div id="scroll-sentinel"
      style="height:60px;display:flex;align-items:center;justify-content:center;
      padding:20px;color:#9ca3af;font-size:13px">
    </div>
  `;
  container.appendChild(allSection);

  // Store for paging
  _pagedProducts = products;
  _pageIndex     = 0;

  // Load first page
   _appendPage();
};



// ── Append next page of products to the grid ──
function _appendPage() {
  const grid = document.getElementById("all-products-grid");
  const sentinel = document.getElementById("scroll-sentinel");
  if (!grid) return;

  const slice = _pagedProducts.slice(_pageIndex, _pageIndex + PAGE_SIZE);
  _pageIndex += slice.length;

  slice.forEach(p => {
    const isTrending = (p.score || 0) > 500;
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.cssText = "background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10);cursor:pointer";
    card.onclick = () => window.location.href = `product.html?id=${p.id}`;

    card.innerHTML = `
      <div style="position:relative;background:#f7f7f7">
        <img src="${p.images?.[0] || 'placeholder.jpg'}"
          style="width:100%;aspect-ratio:1/1;object-fit:cover"
          onerror="this.src='placeholder.jpg'">
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

           ${(() => {

  const c = (p.condition || p.details?.condition || "").toLowerCase();

  let badge = "";

  if (c.includes("brand new")) {
    badge = "🆕 Brand New";
  } else if (c.includes("foreign")) {
    badge = "♻️ Foreign Used";
  } else if (c.includes("local")) {
    badge = "♻️ Local Used";
  } else if (c.includes("dubai")) {
    badge = "♻️ Dubai Used";
  } else if (c.includes("refurbished")) {
    badge = "🔧 Refurbished";
  }

  if (!badge) return "";

  let color = "#10b981";

  if (badge.includes("Foreign"))
    color = "#2563eb";

  if (badge.includes("Local"))
    color = "#7c3aed";

  if (badge.includes("Dubai"))
    color = "#0ea5e9";

  if (badge.includes("Refurbished"))
    color = "#f59e0b";

  return `
    <div style="
      position:absolute;
      bottom:8px;
      right:8px;
      background:${color};
      color:white;
      font-size:10px;
      padding:4px 8px;
      border-radius:20px;
      font-weight:700;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      z-index:5;
      white-space:nowrap;
    ">
      ${badge}
    </div>
  `;

})()}

        <button onclick="event.stopPropagation();toggleLike('${p.id}',this)"
style="
position:absolute;
top:8px;
right:8px;
z-index:20;
background:white;
border:none;
width:32px;
height:32px;
border-radius:50%;
font-size:15px;
cursor:pointer;
display:flex;
align-items:center;
justify-content:center;
box-shadow:0 2px 8px rgba(0,0,0,.18);
">
🤍
</button>
      </div>
      <div style="padding:8px">
        <p style="font-size:11px;color:#ff6600;font-weight:700;margin:0 0 3px;
          text-transform:uppercase;letter-spacing:.3px">${p.category || ""}</p>
        <h3 style="font-size:12px;margin:0 0 4px;color:#111827;overflow:hidden;
          text-overflow:ellipsis;white-space:nowrap">${p.name || "No name"}</h3>
        <p style="color:#ff6600;font-weight:800;font-size:14px;margin:0 0 6px">
          UGX ${Number(p.price || 0).toLocaleString()}
        </p>
        <button onclick="event.stopPropagation();window.location.href='product.html?id=${p.id}'"
          style="width:100%;padding:7px;font-size:11px;background:#ff6600;color:white;
          border:none;border-radius:7px;font-weight:700;cursor:pointer;font-family:inherit">
          View →
        </button>
        <p style="color:#9ca3af;font-size:11px;margin:4px 0 0">
          📍 ${p.location || p.seller?.location || "Uganda"}
          ${p.sellerIsVerified ? ' · <span style="color:#10b981;font-weight:700">✅ Verified</span>' : ""}
        </p>
      </div>
    `;
    grid.appendChild(card);
  });

  // Update sentinel
  if (sentinel) {
    if (_pageIndex >= _pagedProducts.length) {
      sentinel.innerHTML = `
        <span style="color:#9ca3af;font-size:12px">
          ✅ You've seen all ${_pagedProducts.length} listing${_pagedProducts.length !== 1 ? "s" : ""}
        </span>`;
    } else {
      sentinel.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px;color:#9ca3af">
          <span style="width:18px;height:18px;border:2px solid #ff6600;
            border-top-color:transparent;border-radius:50%;
            animation:spin 1s linear infinite;display:inline-block"></span>
          Loading more...
        </span>`;
    }
  }
}
 

// ============================================
// CATEGORY SPONSORS — auto-rotating carousel
// Shows below the banner, cycles through all
// active sponsors automatically (no click needed)
// ============================================
async function loadCategorySponsors() {
  const slot = document.getElementById("sponsor-carousel-slot");
  if (!slot) return;

  try {
    const snap = await getDocs(query(
      collection(db, "category_sponsors"),
      where("active", "==", true)
    ));

    if (snap.empty) { slot.style.display = "none"; return; }

    const sponsors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    slot.style.display = "block";

    slot.innerHTML = `
      <div style="position:relative;border-radius:14px;overflow:hidden;
        background:linear-gradient(135deg,#ff6600,#ff8c00);
        box-shadow:0 4px 16px rgba(255,102,0,0.25);min-height:70px">
        <div id="sponsor-slides" style="position:relative;min-height:70px">
          ${sponsors.map((s, i) => {
            let url = s.sponsorUrl || "#";
            if (url !== "#" && !url.startsWith("http")) url = "https://" + url;
            return `
              <a href="${url}" target="_blank" rel="noopener noreferrer"
                data-sponsor-idx="${i}"
                style="position:absolute;inset:0;display:flex;align-items:center;gap:12px;
                padding:14px 18px;opacity:${i === 0 ? 1 : 0};transition:opacity .6s ease;
                text-decoration:none;color:white">
                <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);
                  border-radius:8px;display:flex;align-items:center;justify-content:center;
                  font-size:18px;flex-shrink:0">
                  📣
                </div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:10px;font-weight:700;
                    text-transform:uppercase;letter-spacing:.8px;opacity:.85">
                    Sponsored Category
                  </p>
                  <p style="margin:2px 0 0;font-size:14px;font-weight:800;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${capitalize(s.category)} — ${s.sponsorName}
                  </p>
                </div>
                <div style="background:white;color:#ff6600;padding:8px 16px;
                  border-radius:8px;font-weight:900;font-size:12px;
                  white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
                  Visit →
                </div>
              </a>
            `;
          }).join("")}
        </div>
        ${sponsors.length > 1 ? `
          <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
            display:flex;gap:5px;z-index:5">
            ${sponsors.map((_, i) => `
              <span class="sponsor-dot" data-sdot-idx="${i}"
                style="width:6px;height:6px;border-radius:50%;
                background:${i === 0 ? 'white' : 'rgba(255,255,255,.4)'};
                transition:.3s"></span>
            `).join("")}
          </div>` : ""}
      </div>
    `;

    // Auto-rotate every 4.5 seconds
    if (sponsors.length > 1) {
      let current = 0;
      setInterval(() => {
        const slides = slot.querySelectorAll("[data-sponsor-idx]");
        const dots   = slot.querySelectorAll(".sponsor-dot");

        slides[current].style.opacity = "0";
        dots[current].style.background = "rgba(255,102,0,.3)";

        current = (current + 1) % sponsors.length;

        slides[current].style.opacity = "1";
        dots[current].style.background = "#ff6600";
      }, 4500);
    }

  } catch(e) {
    console.warn("loadCategorySponsors:", e.message);
    slot.style.display = "none";
  }
}

function capitalize(str) {
  return (str || "").charAt(0).toUpperCase() + (str || "").slice(1);
}

 
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

  window.renderProducts();
};

window.openSellerShop = function(userId) {
  window.location.href = `shop.html?seller=${userId}`;
};

window.filterSubcategory = function(subcat) {
  currentSubcategory = subcat;

  // Resume normal category view — hide subcategory overlay, show grid
  const overlay = document.getElementById("subcat-sidebar");
  const catGrid  = document.getElementById("zb-cat-grid");
  if (overlay) { overlay.style.display = "none"; overlay.innerHTML = ""; }
  if (catGrid)  { catGrid.style.display = "grid"; }

  window.renderProducts();
};


// ============================================
// APPLY FILTERS
// ============================================
window.applyFilters = function() {
  filterState.priceMin = Number(document.getElementById("price-min")?.value || 0);
  filterState.priceMax = Number(document.getElementById("price-max")?.value || 99999999);
  const districtFilter  = document.getElementById("filter-location")?.value || "";
  const subFilter       = document.getElementById("filter-sublocation")?.value || "";
  filterState.location  = subFilter || districtFilter;

  // Read from whichever sort control triggered this (quick-sort or panel sort)
  const quickSort = document.getElementById("quick-sort")?.value;
  const panelSort  = document.getElementById("filter-sort")?.value;
  filterState.sortBy = quickSort || panelSort || "newest";

  // Keep both dropdowns in sync visually
  const qsEl = document.getElementById("quick-sort");
  const psEl = document.getElementById("filter-sort");
  if (qsEl) qsEl.value = filterState.sortBy;
  if (psEl) psEl.value = filterState.sortBy;

  window.renderProducts();
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
    modalImage.src = product.images?.[0] || "https://zibuy-5deae.web.app/icons/icon-512.png/300";
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

export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const colors = {
    success: "#10b981",
    error:   "#ef4444",
    info:    "#ff6600"
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background: ${colors[type] || colors.success};
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    margin-bottom: 10px;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: toastIn .3s ease;
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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
  const overlay = document.getElementById("subcat-sidebar");
  const catGrid  = document.getElementById("zb-cat-grid");
  if (!overlay) return;

  // "All" selected → show normal category grid, hide overlay
  if (currentCategory === "all") {
    overlay.style.display = "none";
    overlay.innerHTML = "";
    if (catGrid) catGrid.style.display = "grid";
    return;
  }

  // Products within the currently selected category
  const inCategory = products.filter(p => p.category === currentCategory);

  // Count products per subcategory
  const counts = {};
  inCategory.forEach(p => {
    const sub = (p.subcategory || "").trim();
    if (!sub) return;
    counts[sub] = (counts[sub] || 0) + 1;
  });

  const subcats = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // No subcategories found → fall back to normal grid view
  if (subcats.length === 0) {
    overlay.style.display = "none";
    overlay.innerHTML = "";
    if (catGrid) catGrid.style.display = "grid";
    return;
  }

  // Show overlay ON TOP, hide the category grid underneath
  if (catGrid) catGrid.style.display = "none";
  overlay.style.display = "block";

  overlay.innerHTML = `
    <div class="zb-subcat-header">
      <h4>${categoryEmoji(currentCategory)} ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).replace("-", " ")}</h4>
      <button class="zb-subcat-back" onclick="filterCategory('all')">
        ← All Categories
      </button>
    </div>

    <div class="zb-subcat-grid">
      <button class="zb-subcat-item ${currentSubcategory === 'all' ? 'active' : ''}"
        onclick="filterSubcategory('all')">
        <span>All</span>
        <span class="count">${inCategory.length}</span>
      </button>

      ${subcats.map(([sub, count]) => `
        <button class="zb-subcat-item ${currentSubcategory === sub ? 'active' : ''}"
          onclick="filterSubcategory('${sub.replace(/'/g, "\\'")}')">
          <span>${sub}</span>
          <span class="count">${count}</span>
        </button>
      `).join("")}
    </div>
  `;
}


let deferredPrompt;

// Capture install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const btn    = document.getElementById("installBtn");
  const banner = document.getElementById("installBanner");
  if (btn)    btn.style.display    = "block";
  if (banner) banner.style.display = "flex";
});

// Install button click
function installZiBuy() {
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
  const btn    = document.getElementById("installBtn");
  const banner = document.getElementById("installBanner");
  if (btn)    btn.style.display    = "none";
  if (banner) banner.style.display = "none";
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
// LOGIN
// ============================================
window.customerLogin = async function() {
  const { signInWithEmailAndPassword } =
    await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

  const email    = document.getElementById("auth-email")?.value.trim();
  const password = document.getElementById("auth-password")?.value.trim();

  if (!email || !password) { alert("Enter email and password"); return; }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
    showToast("✅ Logged in successfully!");
  } catch (err) {
    const msgs = {
      "auth/user-not-found":  "No account with that email",
      "auth/wrong-password":  "Incorrect password",
      "auth/invalid-credential": "Invalid email or password",
      "auth/too-many-requests": "Too many attempts. Try again later."
    };
    alert("❌ " + (msgs[err.code] || err.message));
  }
};


window.openAuthModal = function() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("open");
};

window.closeAuthModal = function() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("open");
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

    const phone = document.getElementById("reg-phone")?.value.trim() || "";

    // ✅ Save to Firestore users collection
    await setDoc(doc(db, "users", user.uid), {
      email:          user.email,
      uid:            user.uid,
      phone:          phone,
      plan:           "free",
      accountType:    "normal",
      isSellerVerified: false,
      banned:         false,
      createdAt:      new Date()
    });

    // Wire referral if this user came via a referral link
    const { attachReferral, ensureReferralCode } = await import("./referral.js");
    await attachReferral(user.uid);
    await ensureReferralCode(user.uid);

    alert("✅ Account created! You're now logged in.");
    closeAuthModal();
  } catch (err) {
    alert("❌ " + err.message);
  }
};

// ============================================
// LIKE / WISHLIST TOGGLE
// ============================================
window.toggleLike = async function(productId, btnEl) {
  if (!auth.currentUser) {
    showToast("Login to save to wishlist", "info");
    return;
  }

  const uid = auth.currentUser.uid;

  try {
    // Check if already liked
    const existing = await getDocs(query(
      collection(db, "likes"),
      where("userId", "==", uid),
      where("productId", "==", productId)
    ));

    if (!existing.empty) {
      // Unlike — remove from Firestore
      for (const d of existing.docs) {
        await deleteDoc(doc(db, "likes", d.id));
      }
      if (btnEl) btnEl.textContent = "🤍";
      showToast("Removed from wishlist", "info");
    } else {
      // Like — save to Firestore
      await addDoc(collection(db, "likes"), {
        userId: uid,
        productId,
        createdAt: new Date()
      });
      if (btnEl) btnEl.textContent = "❤️";
      showToast("Saved to wishlist!", "success");
    }
  } catch (err) {
    console.error("toggleLike error:", err);
    showToast("Failed to save", "error");
  }
};

// ── Infinite scroll observer (fires once on load) ──
(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (_isLoadingMore) return;
      if (_pageIndex >= _pagedProducts.length) return;

      _isLoadingMore = true;
      setTimeout(() => {
        _appendPage();
        _isLoadingMore = false;
      }, 350);
    });
  }, { rootMargin: "200px" });

  // Watch for sentinel being added to DOM
  const mo = new MutationObserver(() => {
    const sentinel = document.getElementById("scroll-sentinel");
    if (sentinel) {
      observer.observe(sentinel);
    }
  });

  mo.observe(document.body, { childList: true, subtree: true });
})();


// ============================================
// SEARCH OVERLAY
// ============================================

window.openSearchOverlay = function() {
  const overlay = document.getElementById("search-overlay");
  if (!overlay) return;

  overlay.style.display = "flex";

  // Focus the overlay input after a tiny delay (mobile keyboards)
  setTimeout(() => {
    const inp = document.getElementById("overlay-search-input");
    if (inp) inp.focus();
  }, 100);

  // Prevent body scroll while overlay is open
  document.body.style.overflow = "hidden";
};

window.closeSearchOverlay = function() {
  const overlay = document.getElementById("search-overlay");
  if (!overlay) return;

  overlay.style.display = "none";
  document.body.style.overflow = "";

  // Clear the overlay input
  const inp = document.getElementById("overlay-search-input");
  if (inp) inp.value = "";

  // Reset product results and show quick cats again
  const results  = document.getElementById("overlay-product-results");
  const quickCats = document.getElementById("overlay-quick-cats");
  if (results)   results.innerHTML = "";
  if (quickCats) quickCats.style.display = "block";

  const clearBtn = document.getElementById("overlay-clear-btn");
  if (clearBtn) clearBtn.style.display = "none";
};

window.clearOverlaySearch = function() {
  const inp = document.getElementById("overlay-search-input");
  if (inp) { inp.value = ""; inp.focus(); }

  const results   = document.getElementById("overlay-product-results");
  const quickCats = document.getElementById("overlay-quick-cats");
  const clearBtn  = document.getElementById("overlay-clear-btn");

  if (results)   results.innerHTML = "";
  if (quickCats) quickCats.style.display = "block";
  if (clearBtn)  clearBtn.style.display = "none";
};

window.runOverlaySearch = function(query) {
  const results   = document.getElementById("overlay-product-results");
  const quickCats = document.getElementById("overlay-quick-cats");
  const clearBtn  = document.getElementById("overlay-clear-btn");
  if (!results) return;

  const q = (query || "").toLowerCase().trim();

  // Show/hide clear button
  if (clearBtn) clearBtn.style.display = q ? "block" : "none";

  if (!q) {
    results.innerHTML = "";
    if (quickCats) quickCats.style.display = "block";
    return;
  }

  if (quickCats) quickCats.style.display = "none";

  // Search across name, category, subcategory, description, location
  const matches = (window.allProducts || [])
    .filter(p => {
      if (p.status && p.status !== "active") return false;
      const text = `
        ${p.name || ""}
        ${p.category || ""}
        ${p.subcategory || ""}
        ${p.description || ""}
        ${p.location || ""}
        ${p.seller?.location || ""}
      `.toLowerCase();
      return text.includes(q);
    })
    .slice(0, 30);

  if (matches.length === 0) {
    results.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#9ca3af">
        <p style="font-size:40px;margin-bottom:12px">🔍</p>
        <p style="font-size:16px;font-weight:700;color:#111827">
          No results for "${query}"
        </p>
        <p style="font-size:13px;margin-top:6px">
          Try a different word or browse categories below
        </p>
        <button onclick="closeSearchOverlay()"
          style="margin-top:16px;background:#ff6600;color:white;
          border:none;padding:12px 24px;border-radius:10px;
          font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">
          Browse All →
        </button>
      </div>`;
    return;
  }

  // Get condition helper
  function getCondition(p) {
    return (
      p.condition ||
      p.details?.condition ||
      p.details?.["cf-condition"] ||
      ""
    ).trim();
  }

  function conditionBadge(cond) {
    if (!cond) return "";
    const lower = cond.toLowerCase();
    let color = "#6b7280";
    let bg    = "#f3f4f6";
    if (lower.includes("brand new"))          { color="#065f46"; bg="#d1fae5"; }
    else if (lower.includes("foreign used") ||
             lower.includes("london")       ||
             lower.includes("dubai"))         { color="#1e40af"; bg="#dbeafe"; }
    else if (lower.includes("local used"))    { color="#92400e"; bg="#fef3c7"; }
    else if (lower.includes("refurbished"))   { color="#5b21b6"; bg="#ede9fe"; }
    return `<span style="display:inline-block;background:${bg};color:${color};
      padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;
      margin-right:4px">${cond}</span>`;
  }

  results.innerHTML = `
    <p style="font-size:12px;color:#9ca3af;font-weight:700;margin:0 0 12px">
      ${matches.length} result${matches.length !== 1 ? "s" : ""} for
      "<strong style="color:#111827">${query}</strong>"
    </p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${matches.map(p => {
        const img       = p.images?.[0] || "";
        const price     = Number(p.price || 0).toLocaleString();
        const loc       = p.seller?.location || p.location || "";
        const condition = getCondition(p);
        const badge     = conditionBadge(condition);
        const since     = p.sellerMemberSince
          ? `<p style="margin:2px 0 0;font-size:10px;color:#adb5bd">🗓️ ${p.sellerMemberSince}</p>`
          : "";

        return `
          <div onclick="closeSearchOverlay();window.location.href='product.html?id=${p.id}'"
            style="background:white;border-radius:12px;overflow:hidden;
            box-shadow:0 2px 10px rgba(0,0,0,0.07);cursor:pointer;
            border:1.5px solid #f0f0f0;transition:.2s"
            onmouseover="this.style.borderColor='#ff6600'"
            onmouseout="this.style.borderColor='#f0f0f0'">
            <div style="position:relative">
              <img src="${img}" alt="${p.name}"
                onerror="this.src='https://via.placeholder.com/200?text=No+Image'"
                style="width:100%;aspect-ratio:1/1;object-fit:cover">
              ${p.isPremium ? `
                <div style="position:absolute;top:6px;right:6px;
                  background:linear-gradient(135deg,#ff6600,#ff9900);
                  color:white;padding:2px 7px;border-radius:5px;
                  font-size:10px;font-weight:800">⭐ Featured</div>
              ` : ""}
            </div>
            <div style="padding:9px">
              <p style="margin:0 0 3px;font-size:10px;color:#ff6600;
                font-weight:800;text-transform:uppercase">${p.category || ""}</p>
              <h4 style="margin:0 0 4px;font-size:12px;font-weight:700;
                color:#111827;overflow:hidden;text-overflow:ellipsis;
                white-space:nowrap">${p.name}</h4>
              <p style="margin:0 0 5px;color:#ff6600;font-weight:900;
                font-size:14px">UGX ${price}</p>
              <button style="width:100%;padding:7px;font-size:11px;
                background:#ff6600;color:white;border:none;border-radius:7px;
                font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:6px"
                onclick="event.stopPropagation();closeSearchOverlay();
                window.location.href='product.html?id=${p.id}'">
                View →
              </button>
              ${badge}
              <p style="margin:3px 0 0;font-size:10px;color:#9ca3af">
                ${loc ? `📍 ${loc}` : ""}
              </p>
              ${since}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
};

// Close overlay with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSearchOverlay();
});