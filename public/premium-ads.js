// ============================================
// ZiBuy — Premium Ads / Boost System (CLEAN)
// ============================================

import {
  db,
  auth,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where
} from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let selectedBoost = null;

/* ==============================
   AUTH STATE
============================== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/* ==============================
   BOOST AD (direct activation)
   - Used after payment confirmed
============================== */
export async function boostAd(productId, days, price) {

  const user = auth.currentUser;

  if (!user) {
    alert("Please login to boost ads");
    return false;
  }

  try {

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + days);

    await addDoc(collection(db, "premium_ads"), {
      productId,
      userId: user.uid,
      days,
      price,
      status: "active",
      createdAt: now,
      expiresAt,
      clicks: 0
    });

    await updateDoc(doc(db, "products", productId), {
      "boost.active": true,
      "boost.startDate": now,
      "boost.endDate": expiresAt
    });

    return true;

  } catch (err) {
    console.error("boostAd error:", err);
    return false;
  }
}
/* ==============================
   GET FEATURED ADS
============================== */
export async function getFeaturedAds() {

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "premium_ads"),
        where("status", "==", "active")
      )
    );

    const featured = [];
    const now = new Date();

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      const end =
        data.expiresAt?.toDate?.() || data.expiresAt;

      if (end && new Date(end) > now) {
        featured.push(data);
      }
    });

    return featured;

  } catch (err) {
    console.error("getFeaturedAds error:", err);
    return [];
  }
}

/* ==============================
   TRACK CLICKS
============================== */
export async function trackAdClick(productId) {

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "premium_ads"),
        where("productId", "==", productId),
        where("status", "==", "active")
      )
    );

    if (!snapshot.empty) {

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      await updateDoc(docSnap.ref, {
        clicks: (data.clicks || 0) + 1
      });
    }

  } catch (err) {
    console.error("trackAdClick error:", err);
  }
}

/* ==============================
   SHOW BOOST MODAL
============================== */
window.showBoostModal = function(productId, productName) {

  if (!currentUser) {
    alert("Login to boost");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal open";
  modal.id = "boost-modal-" + productId;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px">
      <div class="modal-header">
        <h2>⭐ Boost Your Ad</h2>
        <button class="modal-close"
          onclick="document.getElementById('boost-modal-${productId}').remove()">
          ×
        </button>
      </div>

      <p style="color:#6b7280;margin-bottom:20px;font-size:15px">
        Make <strong>${productName}</strong> stand out!
      </p>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">

        <div class="boost-option"
          onclick="selectBoost(this, '${productId}', 7, 5000)">
          <p><strong>7 Days</strong> — UGX 5,000</p>
          <input type="radio" name="boost-${productId}">
        </div>

        <div class="boost-option"
          onclick="selectBoost(this, '${productId}', 14, 8000)">
          <p><strong>14 Days</strong> — UGX 8,000</p>
          <input type="radio" name="boost-${productId}">
        </div>

        <div class="boost-option"
          onclick="selectBoost(this, '${productId}', 30, 15000)">
          <p><strong>30 Days</strong> — UGX 15,000</p>
          <input type="radio" name="boost-${productId}">
        </div>

      </div>

      <button class="btn btn-orange"
        onclick="processBoost()"
        style="width:100%;padding:14px;font-size:15px">
        Boost Now 🚀
      </button>

    </div>
  `;

  document.body.appendChild(modal);
};

/* ==============================
   SELECT BOOST PLAN
============================== */
window.selectBoost = function(el, productId, days, price) {

  document.querySelectorAll(`input[name="boost-${productId}"]`)
    .forEach(r => r.checked = false);

  el.querySelector("input").checked = true;

  selectedBoost = { productId, days, price };
};

/* ==============================
   PROCESS BOOST (WHATSAPP FLOW)
   - Payment confirmation flow
============================== */
window.processBoost = async function() {

  if (!selectedBoost) {
    alert("Select a boost plan");
    return;
  }

  const ZIBUY_WHATSAPP = "256790548910";

  try {

    const { productId, days, price } = selectedBoost;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Save pending boost
    await addDoc(collection(db, "premium_ads"), {
      productId,
      userId: currentUser.uid,
      days,
      price,
      status: "pending_payment",
      createdAt: new Date(),
      expiresAt,
      clicks: 0
    });

    const msg = encodeURIComponent(
      `⭐ ZiBuy Boost Request\n\n` +
      `Product: ${productId}\n` +
      `Plan: ${days} Days\n` +
      `Amount: UGX ${price.toLocaleString()}\n\n` +
      `User: ${currentUser.email}`
    );

    window.open(
      `https://wa.me/${ZIBUY_WHATSAPP}?text=${msg}`,
      "_blank"
    );

    document.querySelectorAll(".modal").forEach(m => m.remove());

    alert("✅ Boost request sent. Awaiting payment confirmation.");

  } catch (err) {
    console.error("processBoost error:", err);
    alert("Boost request failed");
  }
};