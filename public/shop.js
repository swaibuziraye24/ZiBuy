import {
  db,
  auth,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  getDoc,
  where
} from "./firebase.js";

import {
  submitReview,
  getSellerReviews,
  renderStars
} from "./reviews.js";

import "./buyer-ratings.js";
import { renderTrustBadge } from "./trust-badge.js";

import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


import { canUserPost } from "./subscription-check.js";

import {
  expireOldAds
} from "./ad-expiry.js";

const params = new URLSearchParams(window.location.search);
const sellerId = params.get("seller");

console.log("Seller ID:", sellerId);



let followDocumentId = null;
let isFollowing = false;

// ── Show Edit button only to the shop owner ──
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
onAuthStateChanged(auth, (user) => {
  const editBtn      = document.getElementById("edit-shop-btn");
  const ordersSection = document.getElementById("orders-to-review-section");

  if (editBtn && user && sellerId && user.uid === sellerId) {
    editBtn.style.display = "inline-block";
    if (ordersSection) ordersSection.style.display = "block";
    loadSellerOrdersToRate();
  }
});

/* ---------------- INIT ---------------- */
loadShop();
loadSellerReviews();
checkFollowStatus();
listenToFollowers();
loadShopHeader();
loadSellerRating();
expireOldAds();

/* ---------------- SHOP PRODUCTS ---------------- */
let _shopAllProducts = [];

async function loadShop() {

  const container =
    document.getElementById("shop-products");

  if (!container) return;

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "products"),
        where("userId", "==", sellerId),
        where("status", "==", "active")
      )
    );

    const products = [];

    snapshot.forEach((docSnap) => {
      products.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    _shopAllProducts = products;
    renderShopProductsGrid(products);

  } catch (err) {
    console.error("SHOP ERROR:", err);
  }
}


// ── ORDERS TO REVIEW (seller rates buyers) ──
window.loadSellerOrdersToRate = async function() {
  const container = document.getElementById("orders-to-review");
  if (!container) return;
  if (!auth.currentUser || auth.currentUser.uid !== sellerId) return;

  container.innerHTML = `<p style="color:#6b7280;font-size:13px;padding:16px;text-align:center">Loading orders...</p>`;

  try {
    let productIds = _shopAllProducts.map(p => p.id);

    // Fallback fetch — covers race condition if this runs before loadShop finishes
    if (productIds.length === 0) {
      const freshSnap = await getDocs(query(
        collection(db, "products"),
        where("userId", "==", sellerId)
      ));
      productIds = freshSnap.docs.map(d => d.id);
    }

    if (productIds.length === 0) {
      container.innerHTML = `<p style="color:#6b7280;font-size:13px;padding:16px;text-align:center">No products yet</p>`;
      return;
    }

    // Firestore 'in' queries max 10 values — batch if needed
    const batches = [];
    for (let i = 0; i < productIds.length; i += 10) {
      batches.push(productIds.slice(i, i + 10));
    }

    let orders = [];
    for (const batch of batches) {
      const snap = await getDocs(query(
        collection(db, "orders"),
        where("productId", "in", batch)
      ));
      snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    }

    // Only Buy Now orders have a real buyerUid
    orders = orders.filter(o => o.buyerUid && o.buyerUid !== "guest");

    if (orders.length === 0) {
      container.innerHTML = `<p style="color:#6b7280;font-size:13px;padding:16px;text-align:center">No orders yet to review</p>`;
      return;
    }

    const ratedSnap = await getDocs(query(
      collection(db, "buyer_ratings"),
      where("sellerId", "==", sellerId)
    ));
    const ratedOrderIds = new Set(ratedSnap.docs.map(d => d.data().orderId));

    container.innerHTML = orders.map(o => {
      const orderKey     = o.orderRef || o.orderId || o.id;
      const alreadyRated = ratedOrderIds.has(orderKey);

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;
          padding:14px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px;flex-wrap:wrap">
          <div>
            <p style="margin:0;font-weight:800;font-size:14px;color:#111827">${o.productName || "Product"}</p>
            <p style="margin:3px 0 0;font-size:12px;color:#6b7280">Buyer: ${o.buyerEmail || o.userEmail || "—"}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#9ca3af">UGX ${Number(o.price || o.total || 0).toLocaleString()}</p>
          </div>
          ${alreadyRated
            ? `<span style="background:#f3f4f6;color:#9ca3af;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700">✅ Rated</span>`
            : `<button onclick="openRateBuyerModal('${sellerId}','${o.buyerUid}','${(o.buyerEmail||o.userEmail||"Buyer").replace(/'/g,"\\'")}','${orderKey}','${o.productId || ""}','${(o.productName||"").replace(/'/g,"\\'")}')"
                style="background:#ff6600;color:white;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">
                ⭐ Rate Buyer
              </button>`}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("loadSellerOrdersToRate:", err);
    container.innerHTML = `<p style="color:#ef4444;font-size:13px;padding:16px">Failed to load orders</p>`;
  }
};

function renderShopProductsGrid(products) {

  const container =
    document.getElementById("shop-products");

  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
  <div class="empty">

    <div style="
      font-size:60px;
      margin-bottom:12px;
    ">
      📦
    </div>

    <h2 style="
      margin:0;
      color:#333;
    ">
      No Products Found
    </h2>

    <p style="
      color:#777;
      margin-top:10px;
    ">
      ${_shopAllProducts.length === 0
        ? "This shop has not uploaded products yet."
        : "No products match your search."}
    </p>

  </div>
`;
    return;
  }

  container.innerHTML = products.map((p) => `
      <div
  class="product-card"
  onclick="
    window.location.href=
    'product.html?id=${p.id}'
  "
>
        <img
  src="${
    p.images?.length
      ? p.images[0]
      : 'https://zibuy-5deae.web.app/icons/icon-512.png/400x300?text=ZiBuy'
  }"
  alt="${p.name || ''}"
  loading="lazy"
>
        <div class="product-info">
          <div class="product-title">${p.name || "No name"}</div>
          <div class="product-price">
           UGX ${new Intl.NumberFormat().format(
  p.price || 0
)}
          </div>
        </div>
      </div>
    `).join("");
}

/* ---------------- SHOP SEARCH ---------------- */
window.filterShopProducts = function(query) {
  const count = document.getElementById("shop-search-count");
  const q = (query || "").toLowerCase().trim();

  const matches = q
    ? _shopAllProducts.filter(p =>
        `${p.name || ""} ${p.category || ""} ${p.description || ""}`
          .toLowerCase().includes(q)
      )
    : _shopAllProducts;

  if (count) {
    count.textContent = q
      ? `${matches.length} result${matches.length !== 1 ? "s" : ""} for "${query}"`
      : "";
  }

  renderShopProductsGrid(matches);
};

/* ---------------- SHOP HEADER (FIXED) ---------------- */
async function loadShopHeader() {

try {


const shopDoc = await getDoc(
  doc(db, "shops", sellerId)
);

if (!shopDoc.exists()) return;

const shop = shopDoc.data();

console.log("SHOP DATA:", shop);

// Main Elements
const nameEl = document.getElementById("shop-name");
const metaEl = document.getElementById("shop-meta");
const logoEl = document.getElementById("shop-logo");
const bannerEl = document.getElementById("shop-banner");

// Business Profile Elements
const verifiedBadge = document.getElementById("verified-badge");
const planBadge = document.getElementById("plan-badge");

const descEl = document.getElementById("shop-description");

const locationEl = document.getElementById("business-location");
const contactEl = document.getElementById("business-contact");
const whatsappEl = document.getElementById("business-whatsapp");

const phoneEl = document.getElementById("business-phone");
const categoriesEl = document.getElementById("shop-categories");
const hoursEl = document.getElementById("business-hours");

// Header
nameEl.textContent = shop.name || "ZiBuy Shop";

metaEl.innerHTML = `
  📍 ${shop.location || "Uganda"}
  ${shop.isVerified ? " • ✅ Verified Seller" : ""}
`;

// Images
if (shop.logoUrl && logoEl) {
  logoEl.src = shop.logoUrl;
}

if (shop.bannerUrl && bannerEl) {
  bannerEl.src = shop.bannerUrl;
}

// Verification Badge
if (verifiedBadge) {
  verifiedBadge.innerHTML = shop.isVerified
    ? `
      <span class="badge badge-verified">
        ✅ Verified Business
      </span>
    `
    : "";
}

// Trust Badge
renderTrustBadge(sellerId, "shop-trust-badge");

// Plan Badge
if (planBadge) {
  const plan = (shop.plan || "free").toLowerCase();

  planBadge.innerHTML = `
    <span class="badge badge-${plan}">
      ${plan.toUpperCase()} PLAN
    </span>
  `;
}

// Description
if (descEl) {
  descEl.textContent =
    shop.description ||
    "Professional ZiBuy Seller";
}

// Location
if (locationEl) {
  locationEl.innerHTML =
    `📍 ${shop.location || "Uganda"}`;
}

// Email
if (contactEl) {
  contactEl.innerHTML =
    `📧 ${shop.email || "Not provided"}`;
}

// Phone
if (phoneEl) {
  phoneEl.innerHTML =
    `📞 ${shop.phone || "Not provided"}`;
}

// WhatsApp
if (whatsappEl) {
  whatsappEl.innerHTML =
    `📱 ${shop.whatsapp || shop.phone || "Not provided"}`;
}

// Categories
if (categoriesEl) {

  const categories =
    shop.categories || [];

  categoriesEl.innerHTML =
    categories.length
      ? categories.map(cat => `
          <span
            style="
              display:inline-block;
              background:#fff4ee;
              color:#ff6600;
              padding:6px 12px;
              border-radius:20px;
              font-size:12px;
              font-weight:700;
              margin:4px;
            "
          >
            ${cat}
          </span>
        `).join("")
      : "No categories specified";
}

// Business Hours
if (hoursEl && shop.businessHours) {

  hoursEl.innerHTML =
    Object.entries(shop.businessHours)
      .map(([day, hours]) => {

        return `
          <div style="
            display:flex;
            justify-content:space-between;
            padding:6px 0;
            border-bottom:1px solid #f3f4f6;
          ">
            <span>${day}</span>
            <span>
              ${hours.closed
                ? "Closed"
                : `${hours.open} - ${hours.close}`}
            </span>
          </div>
        `;

      })
      .join("");
}


} catch (err) {


console.error(
  "Shop header error:",
  err
);


}

}

/* ---------------- REVIEWS ---------------- */
async function loadSellerReviews() {

  const container =
    document.getElementById("reviews-list");

  if (!container) return;

  const data = await getSellerReviews(sellerId);

  if (data.reviews.length === 0) {
    container.innerHTML = "<p>No reviews yet</p>";
    return;
  }

  container.innerHTML = data.reviews.map((review) => `
    <div style="padding:15px; margin-bottom:10px; background:#fafafa; border:1px solid #eee; border-radius:12px;">
      <div style="color:#ff6600; font-weight:700;">
        ${renderStars(review.rating)}
      </div>
      <p>${review.text}</p>
      <small>${review.reviewerEmail || "Anonymous"}</small>
    </div>
  `).join("");
}

/* ---------------- SUBMIT REVIEW ---------------- */
window.submitSellerReview = async function () {
  const rating = document.getElementById("review-rating").value;
  const text   = document.getElementById("review-text").value.trim();

  if (!text) return alert("Write a review first");

  if (!auth.currentUser) return alert("You must be logged in to review");

  const btn = document.getElementById("submit-review-btn");
  if (btn) { btn.textContent = "Posting..."; btn.disabled = true; }

  const success = await submitReview(sellerId, null, rating, text);

  if (success) {
    // Recalculate and save average rating back to the shop document
    try {
      const { getDocs, query, where, collection, doc, updateDoc } =
        await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

      const reviewsSnap = await getDocs(query(
        collection(db, "reviews"),
        where("sellerId", "==", sellerId)
      ));

      let total = 0;
      let count = 0;
      reviewsSnap.forEach(d => {
        total += Number(d.data().rating || 0);
        count++;
      });

      const avgRating = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;

      // Update both shops and business_profiles collections
      await updateDoc(doc(db, "shops", sellerId), {
        avgRating,
        reviewCount: count
      }).catch(() => {});

      await updateDoc(doc(db, "business_profiles", sellerId), {
        avgRating,
        reviewCount: count
      }).catch(() => {});

    } catch(e) {
      console.warn("Rating update failed:", e.message);
    }

    document.getElementById("review-text").value = "";
    loadSellerReviews();
    loadSellerRating(); // refresh the star display immediately

    // Show toast instead of alert
    const toast = document.createElement("div");
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:#10b981;color:white;padding:12px 24px;border-radius:10px;
      font-weight:700;font-size:14px;z-index:99999;
      box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "✅ Review posted! Thank you.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } else {
    alert("Failed to post review. Please try again.");
  }

  if (btn) { btn.textContent = "Submit Review"; btn.disabled = false; }
};

/* ---------------- FOLLOW SYSTEM ---------------- */
async function checkFollowStatus() {

  if (!auth.currentUser) return;

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "shop_followers"),
        where("shopId", "==", sellerId),
        where("userId", "==", auth.currentUser.uid)
      )
    );

    if (!snapshot.empty) {

      followDocumentId = snapshot.docs[0].id;
      isFollowing = true;
      setFollowState(true);

    } else {

      isFollowing = false;
      setFollowState(false);

    }

  } catch (err) {

    console.error(
      "Follow status error:",
      err
    );

  }
}

/* ---------------- FOLLOW ACTION ---------------- */
function setFollowState(state) {
  const btn = document.getElementById("follow-btn");
  if (!btn) return;

  if (state) {
    btn.innerHTML = `✓ Following`;
    btn.style.background = "#10b981";
    btn.style.color      = "white";
    btn.style.border     = "none";
  } else {
    btn.innerHTML = `🔔 Follow Shop`;
    btn.style.background = "white";
    btn.style.color      = "#ff6600";
    btn.style.border     = "1.5px solid #ff6600";
  }
}

window.toggleFollowShop = async function () {

  if (!auth.currentUser) return alert("Login first");

  try {

    if (followDocumentId) {

      await deleteDoc(doc(db, "shop_followers", followDocumentId));

      followDocumentId = null;
      isFollowing = false;
      setFollowState(false);
      return;
    }

    const docRef = await addDoc(
      collection(db, "shop_followers"),
      {
        shopId: sellerId,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        createdAt: new Date()
      }
    );

    followDocumentId = docRef.id;
    isFollowing = true;
    setFollowState(true);

  } catch (err) {
    console.error(err);
  }
};

/* ---------------- FOLLOWERS LIVE ---------------- */
function listenToFollowers() {
  const q = query(
    collection(db, "shop_followers"),
    where("shopId", "==", sellerId)
  );

  onSnapshot(q, (snapshot) => {
    const count = snapshot.size;

    const el1 = document.getElementById("followers-count");
    const el2 = document.getElementById("followers-count-2");
    if (el1) el1.textContent = count;
    if (el2) el2.textContent = count;

    // Update follow button label with live count
    const btn = document.getElementById("follow-btn");
    if (btn && isFollowing) {
      btn.innerHTML = `✓ Following (${count})`;
    } else if (btn) {
      btn.innerHTML = `🔔 Follow (${count})`;
    }
  });
}

/* ---------------- RATING ---------------- */
async function loadSellerRating() {
  const data    = await getSellerReviews(sellerId);
  const ratings = data.reviews.map(r => r.rating);
  const ratingEl = document.getElementById("shop-rating");
  if (!ratingEl) return;

  if (!ratings.length) {
    ratingEl.innerHTML = `<span style="color:#9ca3af;font-size:13px">No reviews yet</span>`;
    return;
  }

  const avg   = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const stars  = Math.round(avg);
  const filled = "⭐".repeat(stars);
  const empty  = "☆".repeat(5 - stars);

  ratingEl.innerHTML = `
    <span style="font-size:16px">${filled}${empty}</span>
    <span style="font-weight:800;color:#111827;margin-left:4px">${avg.toFixed(1)}</span>
    <span style="color:#6b7280;font-size:13px;margin-left:4px">(${ratings.length} review${ratings.length !== 1 ? "s" : ""})</span>
  `;
}

async function checkBeforePosting() {

  const user = auth.currentUser;

  if (!user) {
    alert("Login first");
    return false;
  }

  const check =
    await canUserPost(user.uid);

  if (!check.allowed) {
    alert(
      `❌ Limit reached for ${check.plan} plan. Upgrade to continue.`
    );
    return false;
  }

  return true;
}