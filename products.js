// ============================================
//   ZiBuy — Product Detail Page
// ============================================

import { db, doc, getDoc, collection, addDoc } from "./firebase.js";
import { showToast } from "./app.js";

// Re-import app.js so cart works on this page too
import "./app.js";

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
    let   active = 0;

    // Update page title
    document.title = `${p.name} — ZiBuy`;

    grid.innerHTML = `
      <!-- Images -->
      <div class="product-page-images">
        <img
          id="main-img"
          class="main-img"
          src="${images[0] || ''}"
          alt="${p.name}"
        >
        ${images.length > 1 ? `
          <div class="product-page-thumbs" id="thumbs">
            ${images.map((img, i) => `
              <img
                src="${img}"
                class="${i === 0 ? 'active' : ''}"
                alt="thumb ${i+1}"
                onclick="switchImage(${i})"
              >
            `).join("")}
          </div>` : ""}
      </div>

      <!-- Details -->
      <div class="product-page-details">

        <div class="seller-box">
          <div class="seller-avatar">Z</div>
          <div class="seller-info">
            <h4>ZiBuy Seller</h4>
            <p>📍 Uganda · Verified Seller</p>
          </div>
        </div>

        <p class="product-cat">${p.category || "Product"}</p>
        <h1>${p.name}</h1>
        <p class="product-page-price">UGX ${Number(p.price).toLocaleString()}</p>

        <p class="product-desc">
          ${p.description || "High quality product from ZiBuy marketplace. Contact seller for more details."}
        </p>

        <div class="product-page-actions">
          <button
            class="cart-btn"
            style="font-size:16px;padding:16px;"
            onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${images[0] || ""}')"
          >
            🛒 Add to Cart
          </button>
          <button
            class="view-btn"
            style="font-size:16px;padding:16px;"
            onclick="toggleCart()"
          >
            View Cart
          </button>
        </div>

        <div style="margin-top:20px;padding:16px;background:#fff4ee;border-radius:12px;font-size:13px;color:#b45309">
          🛡️ <strong>Safe buying tip:</strong> Meet the seller in a public place and check the item before paying.
        </div>

      </div>
    `;

    // Expose switchImage globally
    window.switchImage = function(index) {
      active = index;
      document.getElementById("main-img").src = images[index];
      document.querySelectorAll("#thumbs img").forEach((img, i) =>
        img.classList.toggle("active", i === index)
      );
    };

  } catch (err) {
    console.error(err);
    document.getElementById("product-page-grid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280">
        <p style="font-size:18px;font-weight:700">Failed to load product</p>
        <a href="index.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back</a>
      </div>`;
  }
}

loadProduct();
