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
} from "./review.js";

const params =
  new URLSearchParams(window.location.search);

const sellerId =
  params.get("seller");

let followDocumentId = null;

loadShop();
loadSellerReviews();
checkFollowStatus();
// loadReviews(); // Uncomment if you want to load reviews

async function loadShop() {

  const container =
    document.getElementById("shop-products");

  try {

    const snapshot = await getDocs(

      query(
        collection(db, "products"),
        where("userId", "==", sellerId)
      )

    );

    if (snapshot.empty) {

      container.innerHTML = `
        <div class="empty">
          No products found
        </div>
      `;

      return;
    }

    let products = [];

    snapshot.forEach((docSnap) => {

      products.push({
        id: docSnap.id,
        ...docSnap.data()
      });

    });

    const seller =
      products[0].seller || {};

    document.getElementById("shop-name")
    .innerHTML = `
      🏪 ${seller.name || "ZiBuy Seller"}

      ${
        seller.isVerified
        ? '<span style="font-size:18px">✅</span>'
        : ''
      }
    `;

    document.getElementById("shop-meta")
    .innerHTML = `
      📍 ${seller.location || "Uganda"}
      •
      ${products.length} listings
    `;

const businessSnapshot =
  await getDocs(

    query(
      collection(
        db,
        "business_profiles"
      ),
      where(
        "userId",
        "==",
        sellerId
      )
    )

  );

if (!businessSnapshot.empty) {

  const business =
    businessSnapshot.docs[0]
    .data();

  // Banner
  if (business.banner) {

    document
    .getElementById("shop-header")
    .style.backgroundImage =
      `url(${business.banner})`;

    document
    .getElementById("shop-header")
    .style.backgroundSize =
      "cover";

    document
    .getElementById("shop-header")
    .style.backgroundPosition =
      "center";

  }

  // Logo + name
  document
  .getElementById("shop-name")
  .innerHTML = `

    <img
      src="${business.logo}"
      style="
        width:90px;
        height:90px;
        border-radius:50%;
        object-fit:cover;
        border:4px solid white;
        margin-bottom:12px;
      "
    >

    <br>

    🏪
    ${business.businessName}

  `;

}

    container.innerHTML =
      products.map((p) => `

      <div class="product-card">

        <img
          src="${p.images?.[0] || ''}"
        >

        <div class="product-info">

          <div class="product-title">
            ${p.name}
          </div>

          <div class="product-price">
            UGX ${Number(p.price)
              .toLocaleString()}
          </div>

        </div>

      </div>

    `).join("");

  } catch (err) {

    console.error(err);

    container.innerHTML = `
      <div class="empty">
        Failed to load shop
      </div>
    `;

  }

}


async function loadSellerReviews() {

  const container =
    document.getElementById("reviews-list");

  if (!container) return;

  const data =
    await getSellerReviews(sellerId);

  if (data.reviews.length === 0) {

    container.innerHTML =
      "<p>No reviews yet</p>";

    return;
  }

  container.innerHTML =
    data.reviews.map((review) => `

      <div
        style="
          padding:12px 0;
          border-bottom:1px solid #eee;
        "
      >

        <div
          style="
            color:#ff6600;
            font-weight:700;
          "
        >
          ${renderStars(review.rating)}
        </div>

        <p>${review.text}</p>

        <small style="color:#666">
          ${review.reviewerEmail || "Anonymous"}
        </small>

      </div>

    `).join("");

}


window.submitSellerReview = async function() {

  const rating =
    document.getElementById("review-rating").value;

  const text =
    document.getElementById("review-text")
    .value
    .trim();

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

window.toggleFollowShop = async function() {

  if (!auth.currentUser) {

    alert("Login first");

    return;
  }

  const btn =
    document.getElementById("follow-btn");

  try {

    // Unfollow
    if (followDocumentId) {

      await deleteDoc(
        doc(
          db,
          "shop_followers",
          followDocumentId
        )
      );

      followDocumentId = null;

      btn.textContent =
        "Follow Shop";

      btn.style.background =
        "white";

      btn.style.color =
        "#ff6600";

      return;
    }

    // Follow
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

    btn.textContent =
      "✓ Following";

    btn.style.background =
      "#10b981";

    btn.style.color =
      "white";

  } catch (err) {

    console.error(err);

    alert("Failed");

  }

};