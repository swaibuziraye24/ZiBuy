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

    const p = snap.data();
    const images = Array.isArray(p.images) ? p.images : [];
    const seller = p.seller || {};
    let activeImage = 0;

    document.title = `${p.name} — ZiBuy`;

    const phone = (seller.phone || "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(`Hi, I saw *${p.name}* on ZiBuy for UGX ${Number(p.price).toLocaleString()}. Is it still available?`);

   const contactHTML = phone ? `
      <div class="contact-btns" style="margin-top:16px">
        <a class="contact-btn whatsapp-btn" href="https://wa.me/${phone}?text=${waMsg}" target="_blank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.857L.057 23.8l6.088-1.439A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.788 9.788 0 01-5.002-1.368l-.36-.214-3.716.878.938-3.63-.235-.373A9.789 9.789 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
          WhatsApp Seller
        </a>
        <a class="contact-btn call-btn" href="tel:+${phone}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          Call Seller
        </a>
      </div>
    ` : "";

    grid.innerHTML = `
      <!-- Images -->
      <div class="product-page-images">
        <img id="main-img" class="main-img" src="${images[0] || 'https://via.placeholder.com/400'}" alt="${p.name}" style="width:100%;height:380px;object-fit:cover;border-radius:14px;background:#f3f4f6">
        ${images.length > 1 ? `
          <div class="product-page-thumbs" id="thumbs">
            ${images.map((img, i) => `
              <img src="${img}" class="${i === 0 ? 'active' : ''}" alt="thumb ${i+1}" onclick="switchImage(${i})" style="width:72px;height:72px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:0.2s">
            `).join("")}
          </div>` : ""}
      </div>

      <div class="seller-box" style="background:${seller.isVerified ? '#d1fae5' : '#f3f4f6'};border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;border-left:4px solid ${seller.isVerified ? '#10b981' : '#ff6600'}">
          <div style="width:44px;height:44px;background:${seller.isVerified ? '#10b981' : '#ff6600'};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;flex-shrink:0;box-shadow:${seller.isVerified ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none'}">${(seller.name || "Z")[0].toUpperCase()}</div>
          <div>
            <h4 style="margin:0;font-weight:700;color:${seller.isVerified ? '#065f46' : '#111827'}">${seller.name || "ZiBuy Seller"} ${seller.isVerified ? '✅' : ''}</h4>
            <p style="margin:4px 0 0;font-size:12px;color:${seller.isVerified ? '#059669' : '#6b7280'}">📍 ${seller.location || "Uganda"} ${seller.isVerified ? '· ✅ Verified Seller' : ''}</p>
          </div>
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