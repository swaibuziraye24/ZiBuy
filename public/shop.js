import {
  db,
  auth,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot
} from "./firebase.js";

import {
  submitReview,
  getSellerReviews,
  renderStars
} from "./review.js";

import { onSnapshot } from "./firebase.js";


console.log("toggleFollowShop:", window.toggleFollowShop);


const params =
  new URLSearchParams(window.location.search);

const sellerId =
  params.get("seller");
  console.log("Seller ID:", sellerId);

let followDocumentId = null;
let isFollowing = false;


loadShop();
console.log("shop.js loaded");
loadSellerReviews();
checkFollowStatus();
listenToFollowers();
loadShopHeader();

async function loadShop() {

  console.log("Loading shop...");

  const container =
    document.getElementById("shop-products");

  if (!container) {
    console.error("Container not found");
    return;
  }

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "products"),
        where("userId", "==", sellerId)
      )
    );

    console.log(
      "Products found:",
      snapshot.size
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
          No products found
        </div>
      `;

      return;
    }

    container.innerHTML =
      products.map((p) => `

        <div class="product-card">

          <img
            src="${p.images?.[0] || ''}"
            alt="${p.name || ''}"
          >

          <div class="product-info">

            <div class="product-title">
              ${p.name || "No name"}
            </div>

            <div class="product-price">
              UGX ${Number(
                p.price || 0
              ).toLocaleString()}
            </div>

          </div>

        </div>

      `).join("");

  } catch (err) {

    console.error(
      "SHOP ERROR:",
      err
    );

    container.innerHTML = `
      <div class="empty">
        Failed to load products
      </div>
    `;

  }

}


async function loadShopHeader() {
  const container = document.getElementById("shop-name");
  const meta = document.getElementById("shop-meta");

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "users"),
        where("uid", "==", sellerId)
      )
    );

    if (snapshot.empty) return;

    const seller = snapshot.docs[0].data();

    container.textContent = seller.name || "ZiBuy Shop";

    meta.innerHTML = `
      📍 ${seller.location || "Uganda"}  
      ${seller.isVerified ? "✅ Verified Seller" : ""}
    `;

  } catch (err) {
    console.error("Shop header error:", err);
  }
}


async function loadSellerReviews() {

  const container =
    document.getElementById("reviews-list");

  if (!container) return;

  const data =
    await getSellerReviews(sellerId);
loadSellerRating();
  if (data.reviews.length === 0) {

    container.innerHTML =
      "<p>No reviews yet</p>";

    return;
  }

 container.innerHTML =
  data.reviews.map((review) => `
    <div style="
      padding:15px;
      border-radius:12px;
      margin-bottom:12px;
      background:#fafafa;
      border:1px solid #eee;
    ">

      <div style="color:#ff6600; font-weight:700;">
        ${renderStars(review.rating)}
      </div>

      <p style="margin:8px 0;">
        ${review.text}
      </p>

      <small style="color:#777;">
        ${review.reviewerEmail || "Anonymous"}
      </small>

    </div>
  `).join("");

}


window.submitSellerReview = async function () {

  const rating =
    document.getElementById("review-rating").value;

  const text =
    document.getElementById("review-text").value.trim();

  if (!text) {
    alert("Write a review");
    return;
  }

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
    alert("Failed to submit review");
  }
};

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

    const btn =
      document.getElementById("follow-btn");

    if (!snapshot.empty) {

      followDocumentId =
        snapshot.docs[0].id;

        isFollowing = true;


      btn.textContent =
        "✓ Following";

      btn.style.background =
        "#10b981";

      btn.style.color =
        "white";

    }

  } catch (err) {

    console.error(err);

  }

}


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

  if (!auth.currentUser) {
    alert("Login first");
    return;
  }

  const btn = document.getElementById("follow-btn");

  try {

    // UNFOLLOW
    if (followDocumentId) {

      await deleteDoc(
        doc(db, "shop_followers", followDocumentId)
      );

      setFollowState(false);
      followDocumentId = null;

      btn.textContent = "Follow Shop";
      btn.style.background = "white";
      btn.style.color = "#ff6600";

      return;
    }

    // FOLLOW
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

    btn.textContent = "✓ Following";
    btn.style.background = "#10b981";
    btn.style.color = "white";

  } catch (err) {
    console.error(err);
    alert("Failed");
  }
};


function updateFollowButton(isFollowing) {
  const btn = document.getElementById("follow-btn");

  if (!btn) return;

  if (isFollowing) {
    btn.textContent = "✓ Following";
    btn.style.background = "#10b981";
    btn.style.color = "white";
  } else {
    btn.textContent = "Follow Shop";
    btn.style.background = "white";
    btn.style.color = "#ff6600";
  }
}

function listenToFollowers() {
  const q = query(
    collection(db, "shop_followers"),
    where("shopId", "==", sellerId)
  );

  onSnapshot(q, (snapshot) => {
    document.getElementById("followers-count").textContent =
      snapshot.size;
  });
}


function listenFollowers() {
  const q = query(
    collection(db, "shop_followers"),
    where("shopId", "==", sellerId)
  );

  onSnapshot(q, (snapshot) => {
    const el = document.getElementById("followers-count");
    if (el) el.textContent = snapshot.size;
  });
}

listenFollowers();


async function loadSellerRating() {
  const data = await getSellerReviews(sellerId);

  const ratings = data.reviews.map(r => r.rating);

  if (ratings.length === 0) return;

  const avg =
    ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const meta = document.getElementById("shop-meta");

  meta.innerHTML += `
    <div>⭐ ${avg.toFixed(1)} / 5 rating</div>
  `;
}

// 👇 ADD THIS AT THE VERY BOTTOM OF shop.js

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("follow-btn");

  if (btn) {
    btn.addEventListener("click", toggleFollowShop);
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("submit-review-btn");

  if (btn) {
    btn.addEventListener("click", submitSellerReview);
  }
});

console.log("submitSellerReview:", window.submitSellerReview);