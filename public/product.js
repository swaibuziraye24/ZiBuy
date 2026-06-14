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


// ── Smart back button ─────────────────────────
window.goBackToHome = function() {
  // Always go back to index — browser history handles the rest
  // But if we came FROM index (referrer), use history.back()
  // so scroll position and category are preserved
  const referrer = document.referrer;
  if (referrer && referrer.includes("index.html") ||
      referrer && new URL(referrer).pathname === "/") {
    history.back();
  } else {
    window.location.href = "index.html";
  }
};

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

const params = new URLSearchParams(window.location.search);
const id = params.get("id");


// ============================================
// BUILD PRODUCT DETAILS CARD
// Shows all category-specific fields saved with the ad
// ============================================
function buildDetailsCard(p) {
  const details   = p.details   || {};
  const condition = p.condition || details.condition || "";

  // Field label map — human-readable labels
 const LABELS = {
    brand:"Brand", condition:"Condition", storage:"Storage", ram:"RAM",
    network:"Network", battery:"Battery", os:"Operating System", warranty:"Warranty",
    color:"Color", type:"Type", screen:"Screen Size", transmission:"Transmission",
    fuel:"Fuel Type", mileage:"Mileage", drive:"Drive", year:"Year",
    make:"Make / Brand", model:"Model", gender:"For", size:"Size",
    material:"Material", origin:"Made In", quantity:"Quantity",
    packaging:"Packaging", volume:"Size / Volume", movement:"Movement",
    processor:"Processor", platform:"Platform", controllers:"Controllers",
    dimensions:"Dimensions", "service-type":"Service Type",
    experience:"Years of Experience", availability:"Availability",
    delivery:"Delivery", freshness:"Freshness", body:"Body Type",
    engine:"Engine Size", negotiable:"Price Negotiable",
    breed:"Breed / Variety", age:"Age", vaccinated:"Vaccinated",
    purpose:"Purpose", "age-group":"Suitable Age", power:"Power / Capacity",
    destination:"Destination", duration:"Duration", "group-size":"Group Size",
    includes:"Includes", education:"Education Level",
    "location-pref":"Preferred Work Location", salary:"Expected Salary",
    organic:"Farming Method", "service-type":"Service Type"
  };

  // Condition badge color
  function conditionBadge(val) {
    if (!val) return "";
    const colors = {
      "Brand New":              { bg:"#dcfce7", color:"#166534" },
      "Brand New (Sealed)":     { bg:"#dcfce7", color:"#166534" },
      "Brand New (Open Box)":   { bg:"#d1fae5", color:"#065f46" },
      "Foreign Used (UK)":      { bg:"#dbeafe", color:"#1e40af" },
      "Foreign Used (Dubai)":   { bg:"#dbeafe", color:"#1e40af" },
      "Foreign Used":           { bg:"#dbeafe", color:"#1e40af" },
      "Local Used":             { bg:"#fef3c7", color:"#92400e" },
      "Thrift (Mitumba)":       { bg:"#fce7f3", color:"#9d174d" },
      "Refurbished":            { bg:"#ede9fe", color:"#5b21b6" },
      "Fresh Today":            { bg:"#dcfce7", color:"#166534" },
      "Farm Fresh":             { bg:"#dcfce7", color:"#166534" },
    };
    const c = colors[val] || { bg:"#f3f4f6", color:"#374151" };
    return `<span style="background:${c.bg};color:${c.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:800;display:inline-block">${val}</span>`;
  }

  // Collect all detail rows (skip condition — shown as badge)
  const rows = Object.entries(details)
    .filter(([k, v]) => v && k !== "condition")
    .map(([k, v]) => {
      const label = LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g," ");
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;gap:12px">
          <span style="color:#6b7280;font-weight:600;flex-shrink:0">${label}</span>
          <span style="font-weight:700;color:#111827;text-align:right">${v}</span>
        </div>`;
    });

  if (!condition && rows.length === 0) return "";

  return `
    <div style="margin-top:20px;background:white;border:1.5px solid #e5e7eb;
      border-radius:16px;overflow:hidden">

      <!-- Header -->
      <div style="padding:14px 18px;background:#f9fafb;border-bottom:1.5px solid #e5e7eb;
        display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <p style="margin:0;font-size:14px;font-weight:800;color:#111827">📋 Item Details</p>
        ${conditionBadge(condition)}
      </div>

      <!-- Rows -->
      <div style="padding:4px 18px 4px">
        ${rows.length > 0 ? rows.join("") : `<p style="color:#9ca3af;font-size:13px;padding:12px 0">No additional details provided.</p>`}
      </div>

    </div>`;
}


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
             <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h4 style="margin:0;font-size:15px;font-weight:800">${seller.name || "ZiBuy Seller"}</h4>
              ${p.userEmail === "swaibuziraye22@gmail.com" ? `
                <span style="background:linear-gradient(135deg,#111827,#374151);color:white;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:4px">
                  <img src="my_logo.png" style="width:12px;height:12px;object-fit:contain;border-radius:2px"> ZiBuy Official
                </span>` : ""}
            </div>
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
          <button onclick="${p.userEmail === 'swaibuziraye22@gmail.com'
            ? `openBuyNow('${snap.id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${(seller.phone||"").replace(/\D/g,"")}','${seller.name||"Seller"}')`
            : `buyNowWhatsApp('${p.name.replace(/'/g,"\\'")}',${p.price},'${(seller.phone||"").replace(/\D/g,"")}')`
          }"
            style="background:#111827;color:white;border:none;padding:15px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
            ⚡ Buy Now
          </button>
        </div>

        <!-- Contact Buttons -->
        ${contactHTML}

        <!-- Safety tip -->
        ${buildDetailsCard(p)}

        <div style="margin-top:16px;padding:16px;background:#fff4ee;border-radius:12px;font-size:13px;color:#b45309">
          🛡️ <strong>Safe buying tip:</strong> Meet the seller in a public place and check the item before paying.
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


// ============================================
// BUY NOW — Mobile Money payment flow
// ============================================
window.openBuyNow = function(productId, productName, price, sellerPhone, sellerName) {

  const existing = document.getElementById("buy-now-modal");
  if (existing) existing.remove();

  const orderRef  = `ORDER-${productId.slice(0,8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const adminPhone = "256790548910";
  const payPhone   = sellerPhone || adminPhone; // pay seller directly or admin

  const modal = document.createElement("div");
  modal.id = "buy-now-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px;overflow-y:auto
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;font-weight:800">⚡ Buy Now</h2>
        <button onclick="document.getElementById('buy-now-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <!-- Product summary -->
      <div style="background:#f9fafb;border-radius:12px;padding:14px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#6b7280">You are buying</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:800;color:#111827">${productName}</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#ff6600">UGX ${Number(price).toLocaleString()}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Seller: <strong>${sellerName}</strong></p>
      </div>

      <!-- MTN -->
      <div style="border:2px solid #ffcc00;border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ffcc00;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:#111">MTN</div>
          <span style="font-weight:800;font-size:14px">MTN Mobile Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ff6600">*165#</strong> on your MTN line</li>
          <li>Select <strong>Pay With Momo</strong></li>
          <li>Enter Merchant Code: <strong style="color:#ff6600;font-size:15px">27868095</strong></li>
          <li>Amount: <strong style="color:#ff6600">UGX ${Number(price).toLocaleString()}</strong></li>
          <li>Reference: <strong style="color:#ff6600;letter-spacing:.5px">${orderRef}</strong></li>
          <li>Enter PIN to confirm</li>
        </ol>
      </div>

      <!-- Airtel -->
      <div style="border:2px solid #ef4444;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ef4444;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:white">AIRTEL</div>
          <span style="font-weight:800;font-size:14px">Airtel Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ef4444">*185#</strong> on your Airtel line</li>
          <li>Select <strong>Send Money</strong></li>
          <li>Send to: <strong style="color:#ef4444;font-size:15px">+256575996624</strong></li>
          <li>Amount: <strong style="color:#ef4444">UGX ${Number(price).toLocaleString()}</strong></li>
          <li>Reference: <strong style="color:#ef4444;letter-spacing:.5px">${orderRef}</strong></li>
          <li>Enter PIN to confirm</li>
        </ol>
      </div>

      <!-- Transaction ID input -->
      <div style="margin-bottom:14px">
        <label style="font-size:13px;font-weight:800;color:#111827;display:block;margin-bottom:8px">
          📋 Enter your transaction ID after paying
        </label>
        <input type="text" id="buy-txn-ref"
          placeholder="e.g. 1234567890 or REF123456"
          style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#ff6600'"
          onblur="this.style.borderColor='#e5e7eb'">
        <p style="font-size:12px;color:#6b7280;margin-top:6px">
          The confirmation ID from your phone after paying
        </p>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#92400e">
        ⏱️ After entering your transaction ID, tap below to notify the seller via WhatsApp.
      </div>

      <!-- Buttons -->
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="confirmBuyNow('${productId}','${productName.replace(/'/g,"\\'")}',${price},'${sellerPhone}','${orderRef}','${sellerName}')"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          📲 I've Paid — Notify Seller on WhatsApp
        </button>
        <button onclick="document.getElementById('buy-now-modal').remove()"
          style="background:#f3f4f6;color:#6b7280;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;width:100%">
          Cancel
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
};

window.confirmBuyNow = async function(productId, productName, price, sellerPhone, orderRef, sellerName) {
  const txnInput = document.getElementById("buy-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";

  if (!txnRef) {
    if (txnInput) {
      txnInput.style.borderColor = "#ef4444";
      txnInput.focus();
      txnInput.placeholder = "⚠️ Please enter your transaction ID";
    }
    return;
  }

  const btn = event.target;
  btn.textContent = "Saving order...";
  btn.disabled    = true;

  try {
    // Save order to Firestore
    await addDoc(collection(db, "orders"), {
      productId,
      productName,
      price,
      orderRef,
      transactionRef: txnRef,
      userEmail:      auth.currentUser?.email || "guest",
      buyerEmail:     auth.currentUser?.email || "guest",
      buyerUid:       auth.currentUser?.uid   || "guest",
      sellerName,
      sellerPhone,
      paymentMethod:  "mobile_money",
      status:         "pending_verification",
      createdAt:      new Date()
    });

    document.getElementById("buy-now-modal")?.remove();

    // Build WhatsApp message to seller (or admin if no seller phone)
    const waPhone = sellerPhone || "256790548910";
    const waMsg   = encodeURIComponent(
      `Hello ${sellerName} 👋\n\n` +
      `I have paid for your product on *ZiBuy*.\n\n` +
      `📦 *Order Details:*\n` +
      `• Product: *${productName}*\n` +
      `• Amount: *UGX ${Number(price).toLocaleString()}*\n` +
      `• Order Ref: *${orderRef}*\n` +
      `• Transaction ID: *${txnRef}*\n` +
      `• Buyer Email: *${auth.currentUser?.email || "Guest"}*\n\n` +
      `Please confirm and arrange delivery. Thank you! 🙏`
    );

    window.open(`https://wa.me/${waPhone}?text=${waMsg}`, "_blank");

    // Show success
    const success = document.createElement("div");
    success.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;
    success.innerHTML = `
      <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center">
        <p style="font-size:52px;margin-bottom:12px">✅</p>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Order Sent!</h2>
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px;text-align:left">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
            <span style="color:#6b7280">Order Ref</span>
            <strong style="color:#ff6600">${orderRef}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:#6b7280">Transaction ID</span>
            <strong style="color:#ff6600">${txnRef}</strong>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-bottom:20px;line-height:1.6">
          Your payment reference has been sent to the seller via WhatsApp.
          The seller will contact you to arrange delivery.
        </p>
        <button onclick="this.closest('div').parentElement.remove()"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          Done →
        </button>
      </div>
    `;
    document.body.appendChild(success);

  } catch (err) {
    console.error("Buy now error:", err);
    alert("Failed to save order. Please try again.");
    btn.textContent = "📲 I've Paid — Notify Seller on WhatsApp";
    btn.disabled    = false;
  }
};

window.buyNowWhatsApp = function(productName, price, sellerPhone) {
  const clean = sellerPhone.replace(/\D/g, "");

  if (!clean) {
    alert("Seller phone number not available. Please use the WhatsApp button to contact the seller.");
    return;
  }

  const msg = encodeURIComponent(
    `Hello! 👋\n\n` +
    `I want to buy *${productName}* listed on ZiBuy.\n` +
    `💰 Price: *UGX ${Number(price).toLocaleString()}*\n\n` +
    `Is it still available? Please let me know how to proceed. 🙏`
  );

  window.open(`https://wa.me/${clean}?text=${msg}`, "_blank");
};