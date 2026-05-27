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

/* ---------------- SHOP PRODUCTS ---------------- */
async function loadShop() {

  const container =
    document.getElementById("shop-products");

  if (!container) return;

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "products"),
        where("userId", "==", sellerId)
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
      container.innerHTML =
        `<div class="empty">No products found</div>`;
      return;
    }

    container.innerHTML = products.map((p) => `
      <div class="product-card">
        <img src="${p.images?.[0] || ''}" />
        <div class="product-info">
          <div class="product-title">${p.name || "No name"}</div>
          <div class="product-price">
            UGX ${Number(p.price || 0).toLocaleString()}
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

  const nameEl = document.getElementById("shop-name");
  const metaEl = document.getElementById("shop-meta");

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "shops"),
        where("ownerId", "==", sellerId)
      )
    );

    if (snapshot.empty) {

      nameEl.textContent = "ZiBuy Shop";
      metaEl.textContent = "📍 Uganda";
      return;
    }

    const shop = snapshot.docs[0].data();

    nameEl.textContent = shop.name || "ZiBuy Shop";

    metaEl.innerHTML = `
      📍 ${shop.location || "Uganda"}
      ${shop.isVerified ? "✅ Verified" : ""}
    `;

  } catch (err) {
    console.error("Shop header error:", err);
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

  const snapshot = await getDocs(
    query(
      collection(db, "shop_followers"),
      where("shopId", "==", sellerId),
      where("userId", "==", auth.currentUser.uid)
    )
  );

  const btn = document.getElementById("follow-btn");

  if (!btn) return;

  if (!snapshot.empty) {

    followDocumentId = snapshot.docs[0].id;
    setFollowState(true);
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

    const el = document.getElementById("followers-count");
    if (el) el.textContent = snapshot.size;

  });
}

/* ---------------- RATING ---------------- */
async function loadSellerRating() {

  const data = await getSellerReviews(sellerId);

  const ratings = data.reviews.map(r => r.rating);

  if (!ratings.length) return;

  const avg =
    ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const meta = document.getElementById("shop-meta");

  meta.innerHTML += `<div>⭐ ${avg.toFixed(1)} / 5 rating</div>`;
}