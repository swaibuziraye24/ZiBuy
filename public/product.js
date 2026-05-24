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

    window.switchImage = function(index) {
      activeImage = index;
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