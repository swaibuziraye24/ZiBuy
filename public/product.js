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

    const likes = p.likes || 0;
    const likedIds = JSON.parse(localStorage.getItem("zibuy-likes") || "[]");
    const alreadyLiked = likedIds.includes(snap.id);

    grid.innerHTML = `
      <!-- Images -->
      <div class="product-page-images">
        <div style="position:relative">
          <img id="main-img" class="main-img" src="${images[0] || ''}" alt="${p.name}" style="width:100%;height:380px;object-fit:cover;border-radius:14px;background:#f3f4f6">
          <button id="like-btn" onclick="toggleLike('${snap.id}')"
            style="position:absolute;top:14px;right:14px;background:white;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:.2s">
            ${alreadyLiked ? "❤️" : "🤍"}
          </button>
          <span id="like-count" style="position:absolute;bottom:14px;left:14px;background:rgba(0,0,0,0.6);color:white;font-size:13px;font-weight:700;padding:5px 12px;border-radius:20px">
            ❤️ ${likes} likes
          </span>
        </div>
        ${images.length > 1 ? `
          <div class="product-page-thumbs" id="thumbs" style="margin-top:10px">
            ${images.map((img, i) => `
              <img src="${img}" class="${i === 0 ? 'active' : ''}" alt="thumb ${i+1}" onclick="switchImage(${i})" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:2px solid ${i === 0 ? '#ff6600' : 'transparent'};cursor:pointer">
            `).join("")}
          </div>` : ""}
      </div>

      <!-- Details -->
      <div class="product-page-details">

        <!-- Seller Info -->
        <div class="seller-box" style="cursor:pointer" onclick="window.location.href='user-profile.html?id=${p.userId || ''}'">
          <div class="seller-avatar">${(seller.name || "Z")[0].toUpperCase()}</div>
          <div class="seller-info">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <h4 style="margin:0;font-size:15px;font-weight:800">${seller.name || "ZiBuy Seller"}</h4>
              <span id="seller-verified-badge" style="display:none;background:#10b981;color:white;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">✅ Verified</span>
            </div>
            <p style="margin:0;font-size:12px;color:#6b7280">📍 ${seller.location || "Uganda"} · <span id="seller-rating-text">Loading...</span></p>
            <p style="margin:3px 0 0;font-size:12px;color:#6b7280" id="seller-member-since"></p>
          </div>
          <span style="margin-left:auto;font-size:12px;color:#ff6600;font-weight:700;flex-shrink:0">View Profile →</span>
        </div>

        <!-- Category + Title + Price -->
        <p class="product-cat" style="font-size:12px;font-weight:700;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${p.category || "Product"}</p>
        <h1 style="font-size:26px;font-weight:800;color:#111827;line-height:1.2;margin-bottom:10px">${p.name}</h1>
        <p style="font-size:32px;font-weight:900;color:#ff6600;margin-bottom:6px">UGX ${Number(p.price).toLocaleString()}</p>
        <p style="font-size:13px;color:#6b7280;margin-bottom:18px">📍 ${seller.location || "Uganda"} · Posted ${p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : "recently"}</p>

        <!-- Description -->
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px">
          <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:8px">Description</h3>
          <p style="font-size:14px;color:#4b5563;line-height:1.7">${p.description || "High quality product. Contact seller for more details."}</p>
        </div>

        <!-- Primary Actions -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <button onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${images[0] || ""}')"
            style="background:#ff6600;color:white;border:none;padding:15px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
            🛒 Add to Cart
          </button>
          <button onclick="window.location.href='payment.html'" id="buy-now-btn"
            style="background:#111827;color:white;border:none;padding:15px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
            ⚡ Buy Now
          </button>
        </div>

        <!-- Contact Buttons -->
        ${contactHTML}

        <!-- Safety tip -->
        <div style="margin-top:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;display:flex;gap:8px;align-items:flex-start">
          <span>🛡️</span>
          <span><strong>Safety tip:</strong> Meet in a public place, verify the item before paying.</span>
        </div>

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
  const { db } = await import("./firebase.js");

  const container = document.getElementById("product-reviews");
  if (!container) return;

  container.innerHTML = `<p style="color:#6b7280;font-size:13px">Loading reviews...</p>`;

  try {
    const snap = await getDocs(
      query(collection(db, "reviews"), where("productId", "==", productId))
    );

    if (snap.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:#6b7280">
          <p style="font-size:28px;margin-bottom:8px">✍️</p>
          <p style="font-size:14px;font-weight:700">No reviews yet. Be the first!</p>
        </div>`;
      const badge = document.getElementById("avg-rating-badge");
      if (badge) badge.textContent = "No reviews yet";
      return;
    }

    let html = "";
    let totalRating = 0;
    let count = 0;

    snap.forEach((d) => {
      const r = d.data();
      const text = r.reviewText || r.text || "";
      const rating = Number(r.rating) || 0;
      const stars = "⭐".repeat(Math.min(rating, 5));
      const email = r.reviewerEmail || r.userEmail || "Anonymous";
      const initial = email[0].toUpperCase();
      const date = r.createdAt
        ? new Date(r.createdAt.toDate()).toLocaleDateString()
        : "";

      totalRating += rating;
      count++;

      html += `
        <div style="display:flex;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
          <div style="width:40px;height:40px;border-radius:50%;background:#ff6600;color:white;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${initial}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-weight:800;font-size:13px">${email.split("@")[0]}</span>
              <span style="font-size:13px">${stars}</span>
              <span style="font-size:12px;color:#ff6600;font-weight:700;margin-left:auto">${rating}/5</span>
            </div>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.5">${text}</p>
            ${date ? `<p style="margin:6px 0 0;font-size:11px;color:#adb5bd">${date}</p>` : ""}
          </div>
        </div>`;
    });

    container.innerHTML = html;

    const avgRating = (totalRating / count).toFixed(1);
    const badge = document.getElementById("avg-rating-badge");
    if (badge) badge.textContent = `⭐ ${avgRating} · ${count} review${count !== 1 ? "s" : ""}`;

  } catch (err) {
    console.error("Failed to load reviews:", err);
    container.innerHTML = `<p style="color:#ef4444;font-size:13px">Failed to load reviews.</p>`;
  }
};

/* ============================================
   LIKE / UNLIKE
============================================ */
window.toggleLike = async function (productId) {
  const likedIds = JSON.parse(localStorage.getItem("zibuy-likes") || "[]");
  const btn       = document.getElementById("like-btn");
  const countEl   = document.getElementById("like-count");

  try {
    const { doc, getDoc, updateDoc, increment } = await import("./firebase.js");
    const { db } = await import("./firebase.js");

    const ref  = doc(db, "products", productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const alreadyLiked = likedIds.includes(productId);
    const delta        = alreadyLiked ? -1 : 1;

    await updateDoc(ref, { likes: increment(delta) });

    const newLikes = Math.max(0, (snap.data().likes || 0) + delta);

    if (alreadyLiked) {
      const updated = likedIds.filter(id => id !== productId);
      localStorage.setItem("zibuy-likes", JSON.stringify(updated));
      if (btn) btn.textContent = "🤍";
    } else {
      likedIds.push(productId);
      localStorage.setItem("zibuy-likes", JSON.stringify(likedIds));
      if (btn) {
        btn.textContent = "❤️";
        btn.style.transform = "scale(1.4)";
        setTimeout(() => btn.style.transform = "scale(1)", 300);
      }
    }

    if (countEl) countEl.textContent = `❤️ ${newLikes} likes`;

  } catch (err) {
    console.error("Like error:", err);
  }
};

/* ============================================
   CREATE ORDER (Buy Now)
============================================ */
window.createOrder = async function (product) {
  try {
    const { increment } = await import("./firebase.js");

    await addDoc(collection(db, "orders"), {
      productId: product.id,
      name:      product.name,
      price:     product.price,
      sellerId:  product.userId || "",
      createdAt: new Date(),
      status:    "pending"
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
  if (!clean) { alert("Seller phone number not available"); return; }

  const msg = encodeURIComponent(
    `Hello, I want to buy *${name}* listed on ZiBuy for UGX ${Number(price).toLocaleString()}. Is it still available?`
  );

  window.open(`https://wa.me/${clean}?text=${msg}`, "_blank");
};

loadProduct();

/* ============================================
   SUBMIT REVIEW
============================================ */
window.submitProductReview = async function () {
  if (!auth.currentUser) {
    alert("Please login to post a review");
    return;
  }

  // Matches the radio buttons in product.html (name="star")
  const ratingEl    = document.querySelector("input[name='star']:checked");
  const reviewTextEl = document.getElementById("review-text");

  if (!ratingEl || !reviewTextEl) {
    alert("Review form elements not found");
    return;
  }

  const reviewText = reviewTextEl.value.trim();
  const rating     = Number(ratingEl.value);
  const productId  = new URLSearchParams(window.location.search).get("id");

  if (!reviewText) { alert("Please write something before posting"); return; }
  if (!productId)  { alert("Product ID missing"); return; }

  const btn = document.querySelector("button[onclick='submitProductReview()']");
  if (btn) { btn.textContent = "Posting..."; btn.disabled = true; }

  try {
    await addDoc(collection(db, "reviews"), {
      productId,
      sellerId:      currentUser?.uid || "",
      reviewerEmail: auth.currentUser.email,
      text:          reviewText,      // consistent field name
      reviewText,                     // keep both for compatibility
      rating,
      createdAt: new Date()
    });

    reviewTextEl.value = "";
    if (ratingEl) document.querySelector("input[name='star'][value='5']").checked = true;

    // Refresh reviews list
    window.loadProductReviews(productId);

    if (btn) { btn.textContent = "Post Review"; btn.disabled = false; }
    alert("✅ Review posted!");

  } catch (err) {
    console.error("Review submit error:", err);
    alert("Failed to post review. Try again.");
    if (btn) { btn.textContent = "Post Review"; btn.disabled = false; }
  }
};