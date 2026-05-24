// ============================================
//   ZiBuy — Product Detail Page
// ============================================

import { db, doc, getDoc, collection, addDoc } from "./firebase.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./app.js";

// Re-import app.js so cart works on this page too
import "./app.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

const params = new URLSearchParams(window.location.search);
const id     = params.get("id");

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
          <a href="index.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back to listings</a>
        </div>`;
      return;
    }

   
const p      = snap.data();
    const images = Array.isArray(p.images) ? p.images : [];
    const seller = p.seller || {};
    let   active = 0;

    // Update page title
    document.title = `${p.name} — ZiBuy`;

    // Debug seller data
    console.log("Product seller:", seller);
    console.log("Seller phone raw:", seller.phone);

    // Build contact buttons HTML
    const phone = (seller.phone || "").replace(/\D/g, "");
    console.log("Phone cleaned:", phone);
    
    const waMsg = encodeURIComponent(`Hi, I saw *${p.name}* on ZiBuy for UGX ${Number(p.price).toLocaleString()}. Is it still available?`);

    const contactHTML = (phone && phone.length > 9) ? `
      <div class="contact-btns" style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <a class="contact-btn whatsapp-btn" href="https://wa.me/${phone}?text=${waMsg}" target="_blank" style="flex:1;padding:14px;background:#25d366;color:white;border:none;border-radius:12px;font-weight:700;text-decoration:none;text-align:center;cursor:pointer;min-width:150px">
          📱 WhatsApp Seller
        </a>
        <a class="contact-btn call-btn" href="tel:+${phone}" style="flex:1;padding:14px;background:#111827;color:white;border:none;border-radius:12px;font-weight:700;text-decoration:none;text-align:center;cursor:pointer;min-width:150px">
          ☎️ Call Seller
        </a>
      </div>
    ` : `
      <div style="padding:16px;background:#fee2e2;border-radius:12px;color:#991b1b;font-size:13px;margin-top:16px">
        ⚠️ Seller phone number not available
      </div>
    `;

    // ===== ADD THIS ENTIRE SECTION =====
    grid.innerHTML = `
      <!-- Images -->
      <div class="product-page-images">
        <img id="main-img" class="main-img" src="${images[0] || ''}" alt="${p.name}">
        ${images.length > 1 ? `
          <div class="product-page-thumbs" id="thumbs">
            ${images.map((img, i) => `
              <img src="${img}" class="${i === 0 ? 'active' : ''}" alt="thumb ${i+1}" onclick="switchImage(${i})" style="cursor:pointer;border:2px solid ${i === 0 ? '#ff6600' : 'transparent'};border-radius:10px;transition:all 0.2s">
            `).join("")}
          </div>` : ""}
      </div>

      <!-- Details -->
      <div class="product-page-details">

        <div class="seller-box" style="background:${seller.isVerified ? '#d1fae5' : '#f3f4f6'};border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;border-left:4px solid ${seller.isVerified ? '#10b981' : '#ff6600'}">
          <div style="width:44px;height:44px;background:${seller.isVerified ? '#10b981' : '#ff6600'};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;flex-shrink:0;box-shadow:${seller.isVerified ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none'}">${(seller.name || "Z")[0].toUpperCase()}</div>
          <div>
            <h4 style="margin:0;font-weight:700;color:${seller.isVerified ? '#065f46' : '#111827'}">${seller.name || "ZiBuy Seller"} ${seller.isVerified ? '✅' : ''}</h4>
            <p style="margin:4px 0 0;font-size:12px;color:${seller.isVerified ? '#059669' : '#6b7280'}">📍 ${seller.location || "Uganda"} ${seller.isVerified ? '· ✅ Verified Seller' : ''}</p>
          </div>
        </div>

        <p class="product-cat" style="font-size:11px;font-weight:700;color:#ff6600;text-transform:uppercase;margin-bottom:8px">${p.category || "Product"}</p>
        <h1 style="font-size:28px;font-weight:800;margin-bottom:14px">${p.name}</h1>
        <p style="font-size:34px;font-weight:900;color:#ff6600;margin-bottom:24px">UGX ${Number(p.price).toLocaleString()}</p>

        <p style="color:#6b7280;line-height:1.7;margin-bottom:28px">
          ${p.description || "High quality product from ZiBuy marketplace. Contact seller for more details."}
        </p>

        <div style="display:flex;gap:12px;margin-bottom:16px">
          <button class="cart-btn" style="flex:1;padding:16px;font-size:16px;background:#ff6600;color:white;border:none;border-radius:12px;font-weight:700;cursor:pointer" onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${images[0] || ""}')">
            🛒 Add to Cart
          </button>
          <button class="view-btn" style="flex:1;padding:16px;font-size:16px;border:1.5px solid #ff6600;color:#ff6600;background:white;border-radius:12px;font-weight:700;cursor:pointer" onclick="toggleCart()">
            View Cart
          </button>
        </div>

        ${contactHTML}

        <div style="margin-top:16px;padding:16px;background:#fff4ee;border-radius:12px;font-size:13px;color:#b45309">
          🛡️ <strong>Safe buying tip:</strong> Meet the seller in a public place and check the item before paying.
        </div>

      </div>
    `;
    // ===== END ADDITION =====

    
window.switchImage = function(index) {
      active = index;
      document.getElementById("main-img").src = images[index];
      document.querySelectorAll("#thumbs img").forEach((img, i) => {
        img.style.borderColor = i === index ? "#ff6600" : "transparent";
      });
    };
   

    loadProductReviews(id);

  } catch (err) {
    console.error(err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#ef4444">
        <p style="font-size:18px;font-weight:700">❌ Failed to load product</p>
        <a href="index.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back</a>
      </div>`;
  }
}

async function loadSellerRating(userId) {
  try {
    const { getDocs, query, where, collection } = await import("./firebase.js");
    const { db } = await import("./firebase.js");
    
    const snapshot = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", userId)));
    
    if (snapshot.size === 0) return;

    let totalRating = 0;
    snapshot.forEach((doc) => {
      totalRating += doc.data().rating;
    });

    const avgRating = (totalRating / snapshot.size).toFixed(1);
    const sellerInfoEl = document.querySelector(".seller-info p");
    if (sellerInfoEl) {
      sellerInfoEl.innerHTML = `📍 ${sellerInfoEl.textContent.split("·")[0]} · ⭐ ${avgRating} (${snapshot.size} reviews)`;
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadProductReviews(productId) {
  try {
    const { getDocs, query, where, collection } = await import("./firebase.js");
    const { db } = await import("./firebase.js");
    
    const snapshot = await getDocs(query(collection(db, "reviews"), where("productId", "==", productId)));
    const container = document.getElementById("product-reviews");
    
    if (snapshot.empty) {
      container.innerHTML = "<p style='color:#6b7280;font-size:13px'>No reviews yet. Be the first!</p>";
      return;
    }

    let html = "";
    let totalRating = 0;

    snapshot.forEach((doc) => {
      const review = doc.data();
      const stars = "⭐".repeat(review.rating);
      const date = new Date(review.createdAt.toDate()).toLocaleDateString();
      html += `
        <div style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px">
          <p style="margin:0;font-weight:700">${stars} ${review.rating}/5</p>
          <p style="margin:4px 0;color:#6b7280">${review.text}</p>
          <p style="margin:4px 0;font-size:11px;color:#adb5bd">${review.reviewerEmail} • ${date}</p>
        </div>
      `;
      totalRating += review.rating;
    });

    const avgRating = (totalRating / snapshot.size).toFixed(1);
    container.innerHTML = `
      <p style="font-weight:700;margin:0 0 8px">⭐ ${avgRating} (${snapshot.size} reviews)</p>
      ${html}
    `;
  } catch (err) {
    console.error(err);
  }
}

window.submitProductReview = async function() {
  const { auth } = await import("./firebase.js");
  const { addDoc, collection } = await import("./firebase.js");
  const { db } = await import("./firebase.js");

  if (!auth.currentUser) {
    alert("Login to review");
    return;
  }

  const rating = document.getElementById("review-rating").value;
  const text = document.getElementById("review-text").value.trim();

  if (!text) {
    alert("Write a review");
    return;
  }

  try {
    await addDoc(collection(db, "reviews"), {
      productId: id,
      sellerId: currentUser?.uid || "",
      rating: Number(rating),
      text,
      reviewerEmail: auth.currentUser.email,
      createdAt: new Date()
    });

    document.getElementById("review-text").value = "";
    alert("Review posted!");
    loadProductReviews(id);
  } catch (err) {
    console.error(err);
    alert("Failed to post review");
  }
};

loadProduct();