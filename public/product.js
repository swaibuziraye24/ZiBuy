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

    // ✅ increase views (FIXED — no inline import)
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

        ${images.length > 1
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
          : ""}
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
    onclick="addToCart('${p.name.replace(/'/g,"\\'")}', ${p.price}, '${images[0] || ""}')">
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
   REVIEWS (UNCHANGED LOGIC)
============================================ */
window.loadProductReviews = async function(productId) {

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
  snap.forEach((doc) => {
    const r = doc.data();
    html += `<div>${r.text}</div>`;
  });

  container.innerHTML = html;
}

/* ============================================
   LIKE PRODUCT (FIXED)
============================================ */
window.likeProduct = async function(productId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("Login to like products");
      return;
    }

    const likeId = `${productId}_${user.uid}`;

    const likeRef = doc(db, "product_likes", likeId);
    const productRef = doc(db, "products", productId);

    const snap = await getDoc(likeRef);

    if (snap.exists()) {
      // ❌ unlike
      await deleteDoc(likeRef);
      await updateDoc(productRef, {
        likes: increment(-1)
      });

      updateLikeUI(productId, -1);
    } else {
      // ❤️ like
      await setDoc(likeRef, {
        productId,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      await updateDoc(productRef, {
        likes: increment(1)
      });

      updateLikeUI(productId, +1);
    }

  } catch (err) {
    console.error("Like error:", err);
  }
};


function updateLikeUI(productId, change) {
  const el = document.getElementById(`like-count-${productId}`);
  if (!el) return;

  const current = parseInt(el.textContent || "0");
  el.textContent = current + change;
}

/* ============================================
   ORDER (FIXED)
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