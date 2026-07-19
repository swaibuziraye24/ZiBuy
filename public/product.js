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
  addDoc,
  getDocs,
  query,
  where
} from "./firebase.js";

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./app.js";

import "./app.js";
import "./report-seller.js";
import "./phone-verify.js";
import { renderTrustBadge } from "./trust-badge.js";


// ── Smart back button ─────────────────────────
window.goBackToHome = function() {
  try {
    const referrer = document.referrer;
    // Came from anywhere on ZiBuy itself — safe to use browser back
    const cameFromZiBuy = referrer && referrer.includes(window.location.host);

    if (cameFromZiBuy && window.history.length > 1) {
      history.back();
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    // A malformed referrer must never break the back button
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
    organic:"Farming Method", "service-type":"Service Type",
    "vehicle-type":"Vehicle Type", "work-type":"Type of Work",
    logbook:"Ownership Document", capacity:"Capacity",
    hours:"Working Hours", tools:"Tools / Equipment",
    "listing-type":"Listing Type", "property-type":"Property Type",
    bedrooms:"Bedrooms", bathrooms:"Bathrooms", furnishing:"Furnishing",
    title:"Title / Ownership", amenities:"Amenities",
    "payment-terms":"Payment Terms", seats:"Seating Capacity", gears:"Gears",
    "service-mode":"How Service is Delivered",
    experience:"Years of Experience",
    "pricing-type":"Pricing Type",
    availability:"Availability",
    "response-time":"Response Time",
    "area-covered":"Area Covered",
    "team-size":"Working As",
    qualification:"Qualifications",
    languages:"Languages Spoken",
    negotiable:"Price Negotiable",
    delivery:"Can Travel to Client",
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
          <span style="color:#6b7280;font-weight:600;flex-shrink:0">${escapeHTML(label)}</span>
          <span style="font-weight:700;color:#111827;text-align:right">${escapeHTML(v)}</span>
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

    document.title = `${p.name} — ZiBuy Uganda`;

const description =
  p.description ||
  `${p.name} available on ZiBuy Uganda for UGX ${Number(p.price).toLocaleString()}`;

   
    document
  .getElementById("canonical-url")
  ?.setAttribute("href", window.location.href);


let metaDesc = document.querySelector('meta[name="description"]');

if (!metaDesc) {
  metaDesc = document.createElement("meta");
  metaDesc.name = "description";
  document.head.appendChild(metaDesc);
}

metaDesc.setAttribute("content", description);

// Open Graph
function setMeta(property, content, isName = false) {
  let tag = document.querySelector(
    isName
      ? `meta[name="${property}"]`
      : `meta[property="${property}"]`
  );

  if (!tag) {
    tag = document.createElement("meta");

    if (isName) {
      tag.setAttribute("name", property);
    } else {
      tag.setAttribute("property", property);
    }

    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

setMeta("og:title", p.name);
setMeta("og:description", description);
setMeta("og:image", images[0] || "");
setMeta("og:url", window.location.href);
setMeta("og:type", "product");

// Twitter
setMeta("twitter:card", "summary_large_image", true);
setMeta("twitter:title", p.name, true);
setMeta("twitter:description", description, true);
setMeta("twitter:image", images[0] || "", true);


// Remove old schema if it exists
document
  .querySelectorAll('script[type="application/ld+json"]')
  .forEach(el => el.remove());

const schema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "category": p.category || "",
  "name": p.name,
  "image": images,
  "description": p.description || "",
  "brand": {
    "@type": "Brand",
    "name": p.details?.brand || "ZiBuy"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "UGX",
    "price": p.price,
    "itemCondition": "https://schema.org/UsedCondition",
    "availability": "https://schema.org/InStock",
    "url": window.location.href,
    "seller": {
      "@type": "Organization",
      "name": seller.name || "ZiBuy Seller"
    }
  }
}

const schemaTag = document.createElement("script");
schemaTag.type = "application/ld+json";
schemaTag.id = "product-schema";
schemaTag.textContent = JSON.stringify(schema);

document.head.appendChild(schemaTag);

 
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
              <h4 style="margin:0;font-size:15px;font-weight:800">${escapeHTML(seller.name) || "ZiBuy Seller"}</h4>
              ${p.userEmail === "swaibuziraye22@gmail.com" ? `
                <span style="background:linear-gradient(135deg,#111827,#374151);color:white;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:4px">
                  <img src="my_logo.png" style="width:12px;height:12px;object-fit:contain;border-radius:2px"> ZiBuy Official
                </span>` : ""}
            </div>
              <span id="seller-verified-badge" style="display:none;background:#10b981;color:white;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">✅ Verified</span>
              <span id="seller-phone-verified-badge" style="display:none;background:#3b82f6;color:white;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">📱 Phone Verified</span>
              <span id="seller-trust-badge"></span>
            </div>
            <p style="margin:0;font-size:12px;color:#6b7280">📍 ${escapeHTML(seller.location) || "Uganda"} · <span id="seller-rating-text">Loading...</span></p>
            <p style="margin:3px 0 0;font-size:12px;color:#6b7280" id="seller-member-since"></p>
          </div>
          <span style="margin-left:auto;font-size:12px;color:#ff6600;font-weight:700;flex-shrink:0">View Profile →</span>
        </div>

        <button onclick="openReportModal('${p.userId || ""}','${(seller.name || "Seller").replace(/'/g,"\\'")}', '${snap.id}', '${p.name.replace(/'/g,"\\'")}')"
          style="display:inline-flex;align-items:center;gap:6px;background:white;color:#ef4444;
          border:1.5px solid #ef4444;padding:10px 16px;border-radius:10px;font-weight:800;
          font-size:13px;cursor:pointer;font-family:inherit;margin-top:10px;width:100%;
          justify-content:center;transition:.15s"
          onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
          🚩 Report this Seller
        </button>

        <!-- Category + Title + Price -->
        <p class="product-cat" style="font-size:12px;font-weight:700;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${p.category || "Product"}</p>
        <h1 style="font-size:26px;font-weight:800;color:#111827;line-height:1.2;margin-bottom:10px">${escapeHTML(p.name)}</h1>
        <p style="font-size:32px;font-weight:900;color:#ff6600;margin-bottom:6px">UGX ${Number(p.price).toLocaleString()}</p>
        <p style="font-size:13px;color:#6b7280;margin-bottom:18px">📍 ${escapeHTML(seller.location) || "Uganda"} · Posted ${p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : "recently"}</p>

        <!-- Description -->
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px">
          <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:8px">Description</h3>
          <p style="font-size:14px;color:#4b5563;line-height:1.7">${escapeHTML(p.description) || "High quality product. Contact seller for more details."}</p>
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
        <div style="margin-top:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;display:flex;gap:8px;align-items:flex-start">
  <span>🛡️</span>
  <span>
    <strong>Safety tip:</strong>
    Meet in a public place, inspect the item before paying, and avoid sending money in advance.
  </span>
</div>
       ${buildDetailsCard(p)}

        ${p.videoUrl ? `
          <div style="margin-top:20px;background:white;border:1.5px solid #e5e7eb;
            border-radius:16px;overflow:hidden">
            <div style="padding:14px 18px;background:#f9fafb;border-bottom:1.5px solid #e5e7eb">
              <p style="margin:0;font-size:14px;font-weight:800;color:#111827">🎬 Service Video</p>
            </div>
            <div style="padding:14px">
              <video controls style="width:100%;border-radius:10px;max-height:320px;background:#000"
                preload="metadata">
                <source src="${p.videoUrl}">
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        ` : ""}

        <div style="margin-top:16px;padding:16px;background:#fff4ee;border-radius:12px;font-size:13px;color:#b45309">
          🛡️ <strong>Safe buying tip:</strong> Meet the seller in a public place, inspect before paying, never send money in advance.
        </div>
    `;

    window.switchImage = function (index) {
      active = index;
      document.getElementById("main-img").src = images[index];
    };

    loadProductReviews(id);
    loadRelatedProducts(p.category, id);
    loadSellerRating(p.userId);
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
            ${escapeHTML(initial)}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-weight:800;font-size:13px">${escapeHTML(email.split("@")[0])}</span>
              <span style="font-size:13px">${stars}</span>
              <span style="font-size:12px;color:#ff6600;font-weight:700;margin-left:auto">${rating}/5</span>
            </div>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.5">${escapeHTML(text)}</p>
            ${date ? `<p style="margin:6px 0 0;font-size:11px;color:#adb5bd">${date}</p>` : ""}
          </div>
        </div>`;
    });

    container.innerHTML = html;

    const avgRating = (totalRating / count).toFixed(1);

    const productSchemaTag = document.getElementById("product-schema");

if (productSchemaTag) {
  const currentSchema = JSON.parse(productSchemaTag.textContent);

  currentSchema.aggregateRating = {
    "@type": "AggregateRating",
    "ratingValue": avgRating,
    "reviewCount": count
  };

  productSchemaTag.textContent = JSON.stringify(currentSchema);
}

// ============================================
// REVIEW SCHEMA FOR GOOGLE
// ============================================

document
  .querySelectorAll(".review-schema")
  .forEach(el => el.remove());

const reviewSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": document.title.replace(" — ZiBuy Uganda", ""),
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": avgRating,
    "reviewCount": count
  }
};



const reviewScript = document.createElement("script");
reviewScript.type = "application/ld+json";
reviewScript.className = "review-schema";
reviewScript.textContent = JSON.stringify(reviewSchema);

document.head.appendChild(reviewScript);
    const badge = document.getElementById("avg-rating-badge");
    if (badge) badge.textContent = `⭐ ${avgRating} · ${count} review${count !== 1 ? "s" : ""}`;

  } catch (err) {
    console.error("Failed to load reviews:", err);
    container.innerHTML = `<p style="color:#ef4444;font-size:13px">Failed to load reviews.</p>`;
  }
};



async function loadRelatedProducts(category, currentProductId) {
  try {
    const { getDocs, query, where, collection, limit } =
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { db } = await import("./firebase.js");

    const snap = await getDocs(query(
      collection(db, "products"),
      where("category", "==", category),
      where("status",   "==", "active"),
      limit(20)
    ));

    const related = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.id !== currentProductId)
      .sort(() => Math.random() - 0.5) // shuffle for variety
      .slice(0, 6);

    if (related.length === 0) return;

    const section = document.createElement("div");
    section.style.cssText = `
      max-width:1100px;margin:24px auto 100px;padding:0 24px`;

    section.innerHTML = `
      <div style="background:white;border-radius:20px;padding:28px;
        box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <h2 style="font-size:18px;font-weight:800;margin:0 0 18px;color:#111827">
          🛍️ You Might Also Like
        </h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px">
          ${related.map(p => {
            const img   = p.images?.[0] || "";
            const price = Number(p.price || 0).toLocaleString();
            const cond  = p.condition || p.details?.condition || p.details?.["cf-condition"] || "";

            let condBadge = "";
            if (cond) {
              const c = cond.toLowerCase();
              let bg = "#f3f4f6", color = "#374151";
              if (c.includes("brand new"))   { bg="#d1fae5"; color="#065f46"; }
              else if (c.includes("foreign")){ bg="#dbeafe"; color="#1e40af"; }
              else if (c.includes("local"))  { bg="#fef3c7"; color="#92400e"; }
              else if (c.includes("refurb")) { bg="#ede9fe"; color="#5b21b6"; }
              condBadge = `<span style="display:inline-block;background:${bg};color:${color};
                padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;
                margin-top:4px">${cond}</span>`;
            }

            return `
              <div onclick="window.location.href='product.html?id=${p.id}'"
                style="background:white;border-radius:12px;overflow:hidden;
                border:1.5px solid #f0f0f0;cursor:pointer;transition:.2s"
                onmouseover="this.style.borderColor='#ff6600';this.style.transform='translateY(-3px)'"
                onmouseout="this.style.borderColor='#f0f0f0';this.style.transform='translateY(0)'">
                <img src="${img}" alt="${p.name}"
                  onerror="this.src='https://via.placeholder.com/200?text=ZiBuy'"
                  style="width:100%;aspect-ratio:1/1;object-fit:cover">
                <div style="padding:10px">
                  <p style="margin:0 0 3px;font-size:10px;color:#ff6600;
                    font-weight:800;text-transform:uppercase">${escapeHTML(p.category)}</p>
                  <h4 style="margin:0 0 4px;font-size:12px;font-weight:700;
                    color:#111827;overflow:hidden;text-overflow:ellipsis;
                    white-space:nowrap">${escapeHTML(p.name)}</h4>
                  <p style="margin:0;color:#ff6600;font-weight:900;font-size:14px">
                    UGX ${price}
                  </p>
                  ${condBadge}
                  <p style="margin:4px 0 0;font-size:10px;color:#9ca3af">
                    📍 ${escapeHTML(p.seller?.location || p.location) || "Uganda"}
                  </p>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Insert before the closing </body> but above the bottom nav
    const anchor = document.getElementById("related-products-anchor");
    if (anchor) {
      anchor.parentNode.insertBefore(section, anchor);
    } else {
      document.body.appendChild(section);
    }

  } catch(e) {
    console.warn("loadRelatedProducts:", e.message);
  }
}


async function loadSellerRating(userId) {
  const ratingEl = document.getElementById("seller-rating-text");
  if (!ratingEl || !userId) return;

  try {
    // Check phone verification status
    const userSnapForPhone = await getDoc(doc(db, "users", userId));
    if (userSnapForPhone.exists() && userSnapForPhone.data().phoneVerified) {
      const phoneBadge = document.getElementById("seller-phone-verified-badge");
      if (phoneBadge) phoneBadge.style.display = "inline-flex";
    }

    const snap = await getDocs(query(
      collection(db, "reviews"),
      where("sellerId", "==", userId)
    ));

    if (snap.empty) {
      ratingEl.textContent = "No reviews yet";
      return;
    }

    let total = 0;
    let count = 0;
    snap.forEach(d => {
      total += Number(d.data().rating || 0);
      count++;
    });

    const avg   = (total / count).toFixed(1);
    const stars = "⭐".repeat(Math.round(total / count));

    ratingEl.textContent = `${stars} ${avg} (${count} review${count !== 1 ? "s" : ""})`;

    // Also show verified badge if seller is verified
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists() && userSnap.data().isSellerVerified) {
      const badge = document.getElementById("seller-verified-badge");
      if (badge) badge.style.display = "inline-block";
    }

    // Show member since
    const memberEl = document.getElementById("seller-member-since");
    if (memberEl && userSnap.exists()) {
      const joined = userSnap.data().createdAt?.toDate?.();
      if (joined) {
        memberEl.textContent = `Member since ${joined.toLocaleDateString("en-UG", { month: "long", year: "numeric" })}`;
      }
    }

  } catch (err) {
    console.warn("loadSellerRating:", err.message);
    const ratingEl = document.getElementById("seller-rating-text");
    if (ratingEl) ratingEl.textContent = "—";
  }

  renderTrustBadge(userId, "seller-trust-badge");
}

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

window.loadProduct = loadProduct;
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
console.log("REVIEW SAVED");
    // Update product aggregate rating
console.log("STARTING AGGREGATE UPDATE");
const reviewsSnap = await getDocs(
  query(
    collection(db, "reviews"),
    where("productId", "==", productId)
  )
);

let total = 0;
let count = 0;

reviewsSnap.forEach(docSnap => {
  const r = docSnap.data();
  total += Number(r.rating || 0);
  count++;
});

const average = count > 0
  ? Number((total / count).toFixed(1))
  : 0;


  console.log("Updating aggregate rating", {
  productId,
  average,
  count
});

console.log("ABOUT TO UPDATE PRODUCT", productId);
try {
  await updateDoc(
    doc(db, "products", productId),
    {
      aggregateRating: {
        ratingValue: average,
        reviewCount: count
      }
    }
  );
console.log("PRODUCT UPDATED");
  console.log("Aggregate rating updated successfully");

} catch (err) {
  console.error("Aggregate update failed:", err);
}

    reviewTextEl.value = "";
    if (ratingEl) document.querySelector("input[name='star'][value='5']").checked = true;

    // Refresh reviews list
    window.loadProductReviews(productId);

    if (btn) { btn.textContent = "Post Review"; btn.disabled = false; }
    alert("✅ Review posted!");
  } catch (err) {
    console.error("Review submit error FULL:", err);
    console.error("Error code:", err?.code);
    console.error("Error message:", err?.message);

    alert(
      "Failed to post review:\n" +
      (err?.message || "Unknown error")
    );

    if (btn) {
      btn.textContent = "Post Review";
      btn.disabled = false;
    }
}

}

// ============================================
// BUY NOW — Mobile Money payment flow
// ============================================
window.openBuyNow = function(productId, productName, price, sellerPhone, sellerName) {

  const existing = document.getElementById("buy-now-modal");
  if (existing) existing.remove();

  const orderRef  = `ORDER-${productId.slice(0,8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const adminPhone = "256789157512";
  const payPhone   = sellerPhone || adminPhone;

  const protectFee = Math.max(1000, Math.round(price * 0.025)); // 2.5%, min UGX 1,000

  const districtOptions = [
    "Kampala","Wakiso","Mukono","Jinja","Mbarara","Entebbe","Gulu","Mbale",
    "Masaka","Fort Portal","Hoima","Arua","Masindi","Bushenyi"
  ].map(d => `<option value="${d}">${d}</option>`).join("");

  const modal = document.createElement("div");
  modal.id = "buy-now-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px;overflow-y:auto
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;font-weight:800">⚡ Buy Now</h2>
        <button onclick="document.getElementById('buy-now-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <div style="background:#f9fafb;border-radius:12px;padding:14px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#6b7280">You are buying</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:800;color:#111827">${escapeHTML(productName)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Seller: <strong>${escapeHTML(sellerName)}</strong></p>
      </div>

      <!-- Delivery details — previously missing entirely -->
      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:800;color:#111827;display:block;margin-bottom:8px">📍 Delivery Details</label>
        <input type="text" id="bn-name" placeholder="Your full name"
          style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:8px">
        <input type="tel" id="bn-phone" placeholder="Your phone number e.g. 256701234567"
          style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:8px">
        <select id="bn-district"
          style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;background:white;margin-bottom:8px">
          <option value="">Select your district</option>
          ${districtOptions}
        </select>
        <input type="text" id="bn-address" placeholder="Area / landmark (e.g. Ntinda, near XYZ shop)"
          style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box">
      </div>

      <!-- ZiBuy Protect toggle -->
      <div style="border:2px solid #10b981;border-radius:14px;padding:16px;margin-bottom:12px;background:#f0fdf4">
        <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">
          <input type="checkbox" id="bn-protect-toggle" checked onchange="toggleBuyNowProtect(${price})"
            style="width:20px;height:20px;margin-top:2px;accent-color:#10b981;cursor:pointer;flex-shrink:0">
          <div>
            <p style="margin:0;font-weight:800;font-size:14px;color:#166534">🛡️ ZiBuy Protect</p>
            <p style="margin:4px 0 0;font-size:12px;color:#15803d;line-height:1.5">
              Confirm you received the item before it's marked complete. If there's a problem,
              raise a dispute and our team steps in.
            </p>
          </div>
        </label>
      </div>

      <!-- Clear price breakdown — this is the part that was invisible before -->
      <div style="background:white;border:1.5px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="color:#6b7280">Item Price</span>
          <span id="bn-item-price" style="font-weight:700">UGX ${Number(price).toLocaleString()}</span>
        </div>
        <div id="bn-fee-line" style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="color:#6b7280">ZiBuy Protect Fee</span>
          <span id="bn-fee-amount" style="font-weight:700;color:#166534">+ UGX ${protectFee.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:15px;padding-top:8px;border-top:1.5px solid #f0f0f0">
          <strong>Total to Pay</strong>
          <strong id="bn-total-display" style="color:#ff6600">UGX ${Number(price + protectFee).toLocaleString()}</strong>
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:#9ca3af">Pay this single total via MTN or Airtel below — item price and protection fee go together in one payment.</p>
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
          <li>Amount: <strong id="bn-total-mtn" style="color:#ff6600">UGX ${Number(price + protectFee).toLocaleString()}</strong></li>
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
          <li>Amount: <strong id="bn-total-airtel" style="color:#ef4444">UGX ${Number(price + protectFee).toLocaleString()}</strong></li>
          <li>Reference: <strong style="color:#ef4444;letter-spacing:.5px">${orderRef}</strong></li>
          <li>Enter PIN to confirm</li>
        </ol>
      </div>

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

  // Prefill name from account email
  const nameInput = document.getElementById("bn-name");
  if (nameInput && auth.currentUser?.email) {
    nameInput.value = auth.currentUser.email.split("@")[0];
  }
};

window.toggleBuyNowProtect = function(price) {
  const checked    = document.getElementById("bn-protect-toggle")?.checked;
  const protectFee = Math.max(1000, Math.round(price * 0.025));
  const total      = checked ? price + protectFee : price;

  const feeLine = document.getElementById("bn-fee-line");
  if (feeLine) feeLine.style.display = checked ? "flex" : "none";

  const totalDisplay = document.getElementById("bn-total-display");
  const mtnEl    = document.getElementById("bn-total-mtn");
  const airtelEl = document.getElementById("bn-total-airtel");
  if (totalDisplay) totalDisplay.textContent = "UGX " + Number(total).toLocaleString();
  if (mtnEl)        mtnEl.textContent        = "UGX " + Number(total).toLocaleString();
  if (airtelEl)      airtelEl.textContent     = "UGX " + Number(total).toLocaleString();
};


window.confirmBuyNow = async function(productId, productName, price, sellerPhone, orderRef, sellerName) {
  const name    = document.getElementById("bn-name")?.value.trim()    || "";
  const phone   = document.getElementById("bn-phone")?.value.trim()   || "";
  const district = document.getElementById("bn-district")?.value      || "";
  const address = document.getElementById("bn-address")?.value.trim() || "";
  const txnInput = document.getElementById("buy-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";

  if (!name || !phone || !district) {
    alert("Please fill in your name, phone, and district so the seller knows where to deliver.");
    return;
  }

  if (!txnRef) {
    if (txnInput) {
      txnInput.style.borderColor = "#ef4444";
      txnInput.focus();
      txnInput.placeholder = "⚠️ Please enter your transaction ID";
    }
    return;
  }

  const location     = address ? `${address}, ${district}` : district;
  const isProtected = document.getElementById("bn-protect-toggle")?.checked || false;
  const protectFee  = isProtected ? Math.max(1000, Math.round(price * 0.025)) : 0;
  const totalPaid   = price + protectFee;

  const btn = event.target;
  btn.textContent = "Saving order...";
  btn.disabled    = true;

  try {
    await addDoc(collection(db, "orders"), {
      productId,
      productName,
      price,
      orderRef,
      transactionRef:    txnRef,
      userEmail:         auth.currentUser?.email || "guest",
      buyerEmail:        auth.currentUser?.email || "guest",
      buyerUid:          auth.currentUser?.uid   || "guest",
      customerName:      name,
      customerPhone:     phone,
      customerLocation:  location,
      sellerName,
      sellerPhone,
      paymentMethod:     "mobile_money",
      status:            "pending_verification",
      protected:         isProtected,
      protectionFee:      protectFee,
      total:             totalPaid,
      deliveryConfirmed: false,
      disputeStatus:     null,
      createdAt:         new Date()
    });

    document.getElementById("buy-now-modal")?.remove();

    const waPhone = sellerPhone || "256789157512";
    const waMsg   = encodeURIComponent(
      `Hello ${sellerName} 👋\n\n` +
      `I have paid for your product on *ZiBuy*.\n\n` +
      `📦 *Order Details:*\n` +
      `• Product: *${productName}*\n` +
      `• Amount: *UGX ${Number(totalPaid).toLocaleString()}*${isProtected ? " (incl. ZiBuy Protect)" : ""}\n` +
      `• Order Ref: *${orderRef}*\n` +
      `• Transaction ID: *${txnRef}*\n\n` +
      `📍 *Delivery To:*\n` +
      `• Name: *${name}*\n` +
      `• Phone: *${phone}*\n` +
      `• Location: *${location}*\n\n` +
      `Please confirm and arrange delivery. Thank you! 🙏`
    );

    window.open(`https://wa.me/${waPhone}?text=${waMsg}`, "_blank");

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
        ${isProtected ? `
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;margin-bottom:16px;font-size:12px;color:#166534;text-align:left">
            🛡️ <strong>ZiBuy Protect active.</strong> Once your item arrives, confirm receipt in
            your dashboard's "My Orders" tab. If something's wrong, you can raise a dispute or cancel instead.
          </div>` : ""}
        <p style="color:#6b7280;font-size:13px;margin-bottom:20px;line-height:1.6">
          Your payment reference has been sent to the seller via WhatsApp along with your delivery details.
        </p>
        <button onclick="this.closest('div').parentElement.remove();window.location.href='dashboard.html?tab=orders'"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          View My Orders →
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