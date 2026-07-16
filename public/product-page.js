// ============================================
//   ZiBuy — Product Detail Page
// ============================================

import { db, doc, getDoc, collection, addDoc } from "./firebase.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./app.js";

// Re-import app.js so cart works on this page too
import "./app.js";
import "./report-seller.js";

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

    // Build contact buttons HTML
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
        <img id="main-img" class="main-img" src="${images[0] || ''}" alt="${p.name}">
        ${images.length > 1 ? `
          <div class="product-page-thumbs" id="thumbs">
            ${images.map((img, i) => `
              <img src="${img}" class="${i === 0 ? 'active' : ''}" alt="thumb ${i+1}" onclick="switchImage(${i})">
            `).join("")}
          </div>` : ""}
      </div>

      <!-- Details -->
      <div class="product-page-details">

        <div class="seller-box">
          <div class="seller-avatar">${(seller.name || "Z")[0].toUpperCase()}</div>
          <div class="seller-info">
            <h4>${seller.name || "ZiBuy Seller"}</h4>
            <p>📍 ${seller.location || "Uganda"} · Verified Seller</p>
          </div>
        </div>

        <p class="product-cat">${p.category || "Product"}</p>
        <h1>${p.name}</h1>
        <p class="product-page-price">UGX ${Number(p.price).toLocaleString()}</p>

        <p class="product-desc">
          ${p.description || "High quality product from ZiBuy marketplace. Contact seller for more details."}
        </p>

        <div class="product-page-actions">
          <button class="cart-btn" style="font-size:16px;padding:16px;"
            onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${images[0] || ""}')">
            🛒 Add to Cart
          </button>
          <button class="view-btn" style="font-size:16px;padding:16px;" onclick="toggleCart()">
            View Cart
          </button>
        </div>

        ${contactHTML}

        <button onclick="messageButton('${seller.phone || currentUser?.email}', '${id}', '${p.name}')" style="width:100%;background:#9333ea;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;cursor:pointer;margin-top:10px;font-family:inherit;font-size:15px">
          💬 Send Message
        </button>

        <div style="margin-top:16px;padding:16px;background:#fff4ee;border-radius:12px;font-size:13px;color:#b45309">
          🛡️ <strong>Safe buying tip:</strong> Meet the seller in a public place and check the item before paying.
        </div>

      </div>
    `;

    window.switchImage = function(index) {
      active = index;
      document.getElementById("main-img").src = images[index];
      document.querySelectorAll("#thumbs img").forEach((img, i) =>
        img.classList.toggle("active", i === index)
      );
    };

    loadProductReviews(id);
    loadSellerRating(p.userId);
    loadRelatedProducts(p.category, id);
    loadSellerBadges(p.userId);

  } catch (err) {
    console.error(err);
    document.getElementById("product-page-grid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280">
        <p style="font-size:18px;font-weight:700">Failed to load product</p>
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


async function loadSellerBadges(userId) {
  if (!userId) return;

  try {
    const { getDocs, query, where, collection, doc, getDoc } = await import("./firebase.js");
    const { db } = await import("./firebase.js");

    // ── Verified badge ────────────────────────
    const verifSnap = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", userId),
      where("status", "==", "approved")
    ));

    if (!verifSnap.empty) {
      const badge = document.getElementById("seller-verified-badge");
      if (badge) badge.style.display = "inline-block";
    }

    // ── Member since ──────────────────────────
    const userSnap = await getDoc(doc(db, "users", userId));
    const memberSinceEl = document.getElementById("seller-member-since");

    if (memberSinceEl) {
      let joinDate = null;

      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Try createdAt field first
        joinDate = userData.createdAt?.toDate?.() || null;
      }

      // Fallback: get date from their earliest product
      if (!joinDate) {
        const productsSnap = await getDocs(query(
          collection(db, "products"),
          where("userId", "==", userId)
        ));
        const dates = productsSnap.docs
          .map(d => d.data().createdAt?.toDate?.())
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (dates.length > 0) joinDate = dates[0];
      }

      if (joinDate) {
        const formatted = joinDate.toLocaleDateString("en-UG", {
          month: "long",
          year:  "numeric"
        });
        memberSinceEl.textContent = `🗓️ Member since ${formatted}`;
      }
    }

  } catch (err) {
    console.error("loadSellerBadges error:", err);
  }
}


async function loadProductReviews(productId) {
  try {
    const { getDocs, query, where, collection } = await import("./firebase.js");
    const { db } = await import("./firebase.js");
    
    const { orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snapshot = await getDocs(query(
      collection(db, "reviews"),
      where("productId", "==", productId)
    ));
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

    reviews.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
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
    const reviewData = {
      productId:     id,
      sellerId:      currentUser?.uid || "",
      rating:        Number(rating),
      text,
      reviewerEmail: auth.currentUser.email,
      createdAt:     new Date()
    };

    await addDoc(collection(db, "reviews"), reviewData);

    // Notify the seller about the new review
    try {
      const { notifyNewReview } = await import("./notifications.js");
      await notifyNewReview(currentUser?.uid || "", id, Number(rating));
    } catch(e) {}

    document.getElementById("review-text").value = "";
    alert("✅ Review posted! Thank you.");
    loadProductReviews(id);
  } catch (err) {
    console.error(err);
    alert("Failed to post review");
  }
};

loadProduct();

window.messageButton = function(sellerName, productId, productName) {
  const sellerEmail = sellerName.includes("@") ? sellerName : prompt("Seller email not found. Continue?");
  if (!sellerEmail) return;
  
  import("./messages.js").then(({ startConversation }) => {
    startConversation(sellerEmail, productId, productName);
  });
};