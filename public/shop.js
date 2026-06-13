import {
  db,
  auth,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where
} from "./firebase.js";

import {
  submitReview,
  getSellerReviews,
  renderStars
} from "./reviews.js";

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

/* ---------------- INIT ---------------- */
loadShop();
loadSellerReviews();
checkFollowStatus();
listenToFollowers();
loadShopHeader();
loadSellerRating();
expireOldAds();

/* ---------------- SHOP PRODUCTS ---------------- */
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
      No Products Yet
    </h2>

    <p style="
      color:#777;
      margin-top:10px;
    ">
      This shop has not uploaded products yet.
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
      : 'https://via.placeholder.com/400x300?text=ZiBuy'
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

  } catch (err) {
    console.error("SHOP ERROR:", err);
  }
}

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

  const rating =
    document.getElementById("review-rating").value;

  const text =
    document.getElementById("review-text").value.trim();

  if (!text) return alert("Write a review");

  const success = await submitReview(
    sellerId,
    null,
    rating,
    text
  );

  if (success) {
    alert("✅ Review submitted");
    document.getElementById("review-text").value = "";
    loadSellerReviews();
  } else {
    alert("Failed");
  }
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

      followDocumentId =
        snapshot.docs[0].id;

      setFollowState(true);

    } else {

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
    btn.textContent = "✓ Following";
    btn.style.background = "#10b981";
    btn.style.color = "white";
  } else {
    btn.textContent = "Follow Shop";
    btn.style.background = "white";
    btn.style.color = "#ff6600";
  }
}

window.toggleFollowShop = async function () {

  if (!auth.currentUser) return alert("Login first");

  try {

    if (followDocumentId) {

      await deleteDoc(doc(db, "shop_followers", followDocumentId));

      followDocumentId = null;
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

    const el1 =
  document.getElementById("followers-count");

const el2 =
  document.getElementById("followers-count-2");

if (el1) {
  el1.textContent = snapshot.size;
}

if (el2) {
  el2.textContent = snapshot.size;
}

  });
}

/* ---------------- RATING ---------------- */
async function loadSellerRating() {

  const data = await getSellerReviews(sellerId);

  const ratings = data.reviews.map(r => r.rating);

  if (!ratings.length) return;

  const avg =
    ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const ratingEl =
  document.getElementById("shop-rating");

if (ratingEl) {

  ratingEl.textContent =
    `⭐ ${avg.toFixed(1)} / 5`;

}
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