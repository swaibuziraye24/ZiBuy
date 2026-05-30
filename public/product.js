// ============================================
//   ZiBuy — Product Detail Page
// ============================================

import {
  db,
  doc,
  getDoc,
  collection,
  updateDoc,
  increment,
  addDoc
} from "./firebase.js";

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./app.js";

import "./app.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

/* ============================================
   LOAD PRODUCT
============================================ */
async function loadProduct() {
  const grid = document.getElementById("product-page-grid");
  if (!id || !grid) return;

  try {
    const snap = await getDoc(doc(db, "products", id));

    if (!snap.exists()) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280">
          <p style="font-size:48px;margin-bottom:16px">😕</p>
          <p style="font-size:18px;font-weight:700">Product not found</p>
          <a href="index.html" style="color:#ff6600;font-weight:700">← Back</a>
        </div>`;
      return;
    }

    const p = snap.data();

    await updateDoc(doc(db, "products", id), {
      views: increment(1)
    });

    const images = Array.isArray(p.images) ? p.images : [];
    const seller = p.seller || {};
    let active = 0;

    document.title = `${p.name} — ZiBuy`;

    const phone = (seller.phone || "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(
      `Hi, I saw *${p.name}* on ZiBuy for UGX ${Number(p.price).toLocaleString()}`
    );

    const contactHTML =
      phone && phone.length > 9
        ? `
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <a href="https://wa.me/${phone}?text=${waMsg}"
           style="flex:1;padding:14px;background:#25d366;color:white;border-radius:12px;text-align:center">
          WhatsApp
        </a>
        <a href="tel:+${phone}"
           style="flex:1;padding:14px;background:#111827;color:white;border-radius:12px;text-align:center">
          Call
        </a>
      </div>`
        : `
      <div style="padding:16px;background:#fee2e2;border-radius:12px">
        ⚠️ No phone number
      </div>`;

    grid.innerHTML = `
      <div>
        <img id="main-img" src="${images[0] || ""}" style="width:100%;border-radius:10px">

        ${
          images.length > 1
            ? `<div id="thumbs">
              ${images
                .map(
                  (img, i) =>
                    `<img src="${img}" onclick="switchImage(${i})"
                      style="width:60px;height:60px;margin:5px;border:2px solid ${
                        i === 0 ? "#ff6600" : "transparent"
                      }">`
                )
                .join("")}
            </div>`
            : ""
        }
      </div>

      <div>
        <h1>${p.name}</h1>
        <p>UGX ${Number(p.price).toLocaleString()}</p>

        <div style="display:flex;gap:12px;margin-bottom:16px">

          <button onclick="likeProduct('${id}')" 
            style="flex:1;padding:16px;font-size:16px;border:1.5px solid #ff4d6d;color:#ff4d6d;background:white;border-radius:12px;font-weight:700">
            ❤️ <span id="like-count-${id}">${p.likes || 0}</span>
          </button>

          <button class="cart-btn"
            style="flex:1;padding:16px;font-size:16px;background:#ff6600;color:white;border:none;border-radius:12px;font-weight:700"
            onclick="addToCart('${p.name.replace(/'/g, "\\'")}', ${p.price}, '${images[0] || ""}')">
            🛒 Add to Cart
          </button>

          <button class="view-btn"
            style="flex:1;padding:16px;font-size:16px;background:#25D366;color:white;border:none;border-radius:12px;font-weight:700"
            onclick="buyNowWhatsApp('${p.name}', ${p.price}, '${seller.phone || ""}')">
            📲 Buy Now
          </button>

        </div>

        ${contactHTML}
      </div>
    `;

    window.switchImage = function (index) {
      active = index;
      document.getElementById("main-img").src = images[index];
    };

    loadProductReviews(id);
  } catch (err) {
    console.error(err);
  }
}

/* ============================================
   RANKING ALGORITHM
============================================ */
const PLAN_SCORE = {
  free: 1,
  basic: 1.5,
  premium: 2
};

/* ============================================
   REVIEWS
============================================ */
window.loadProductReviews = async function (productId) {
  const { getDocs, query, where } = await import("./firebase.js");

  const snap = await getDocs(
    query(collection(db, "reviews"), where("productId", "==", productId))
  );

  const container = document.getElementById("product-reviews");
  if (!container) return;

  if (snap.empty) {
    container.innerHTML = "No reviews yet";
    return;
  }

  let html = "";
  snap.forEach((d) => {
    const r = d.data();
    html += `<div>${r.reviewText || r.text || ""}</div>`;
  });

  container.innerHTML = html;
};

/* ============================================
   LIKE PRODUCT
============================================ */
window.likeProduct = async function (productId) {
  try {
    const { doc, updateDoc, increment } = await import("./firebase.js");

    await updateDoc(doc(db, "products", productId), {
      likes: increment(1)
    });

    const el = document.getElementById(`like-count-${productId}`);
    if (el) {
      el.textContent = Number(el.textContent || 0) + 1;
    }
  } catch (err) {
    console.error("Like error:", err);
  }
};

/* ============================================
   ORDER
============================================ */
window.createOrder = async function (product) {
  try {
    await addDoc(collection(db, "orders"), {
      productId: product.id,
      name: product.name,
      price: product.price,
      sellerId: product.userId || "",
      createdAt: new Date(),
      status: "pending"
    });

    await updateDoc(doc(db, "products", product.id), {
      orders: increment(1)
    });
  } catch (err) {
    console.error("Order failed:", err);
  }
};

/* ============================================
   WHATSAPP BUY NOW
============================================ */
window.buyNowWhatsApp = function (name, price, phone) {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return alert("No phone");

  const msg = encodeURIComponent(
    `Hello, I want *${name}* for UGX ${price}`
  );

  window.location.href = `https://wa.me/${clean}?text=${msg}`;
};

loadProduct();

/* ============================================
   SUBMIT REVIEW
============================================ */
window.submitProductReview = async function () {
  try {
    const reviewText = document.getElementById("reviewText").value;
    const rating = document.getElementById("rating").value;
    const productId = new URLSearchParams(window.location.search).get("id");

    if (!reviewText || !rating) {
      alert("Please fill in all fields");
      return;
    }

    await addDoc(collection(db, "reviews"), {
      productId,
      reviewText,
      rating: Number(rating),
      createdAt: new Date()
    });

    alert("Review submitted successfully!");
  } catch (error) {
    console.error("Error submitting review:", error);
  }
};