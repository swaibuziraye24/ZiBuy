import { db, auth, collection, addDoc, updateDoc, doc, getDocs, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

export async function boostAd(productId, days, price) {
  if (!currentUser) {
    alert("Login to boost ad");
    return false;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await addDoc(collection(db, "premium_ads"), {
      productId,
      userId: currentUser.uid,
      days,
      price,
      status: "active",
      createdAt: new Date(),
      expiresAt,
      clicks: 0
    });

    await updateDoc(doc(db, "products", productId), {
      isPremium: true,
      premiumExpiresAt: expiresAt
    });

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function getFeaturedAds() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "premium_ads"),
      where("status", "==", "active")
    ));

    const featured = [];
    snapshot.forEach((doc) => {
      const premium = doc.data();
      if (new Date(premium.expiresAt.toDate()) > new Date()) {
        featured.push(premium);
      }
    });

    return featured;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function trackAdClick(productId) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "premium_ads"),
      where("productId", "==", productId)
    ));

    if (!snapshot.empty) {
      const premiumDoc = snapshot.docs[0];
      const clicks = (premiumDoc.data().clicks || 0) + 1;
      await updateDoc(premiumDoc.ref, { clicks });
    }
  } catch (err) {
    console.error(err);
  }
}

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
        <button class="modal-close" onclick="document.getElementById('boost-modal-${productId}').remove()">×</button>
      </div>
      
      <p style="color:#6b7280;margin-bottom:20px;font-size:15px">Make <strong>${productName}</strong> stand out! Get more visibility.</p>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
        <div class="boost-option" onclick="selectBoost(this, '${productId}', 7, 5000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">7 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 5,000</p>
          </div>
          <input type="radio" name="boost-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoost(this, '${productId}', 14, 8000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">14 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 8,000</p>
          </div>
          <input type="radio" name="boost-${productId}">
        </div>

        <div class="boost-option" onclick="selectBoost(this, '${productId}', 30, 15000)">
          <div>
            <p style="margin:0;font-weight:700;font-size:16px">30 Days</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:14px">UGX 15,000</p>
          </div>
          <input type="radio" name="boost-${productId}">
        </div>
      </div>

      <button class="btn btn-orange" onclick="processBoost('${productId}')" style="width:100%;padding:14px;font-size:15px">Boost Now 🚀</button>
    </div>
  `;

  document.body.appendChild(modal);
};

window.selectBoost = function(el, productId, days, price) {
  document.querySelectorAll(`input[name="boost-${productId}"]`).forEach(r => r.checked = false);
  el.querySelector("input").checked = true;
  window.selectedBoost = { productId, days, price };
};

window.processBoost = async function() {
  if (!window.selectedBoost) {
    alert("Select a boost plan");
    return;
  }

  const { productId, days, price } = window.selectedBoost;
  const ZIBUY_WHATSAPP = "256790548910"; // ← replace with your number

  try {
    // Save pending boost record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await addDoc(collection(db, "premium_ads"), {
      productId,
      userId:    currentUser.uid,
      days,
      price,
      status:    "pending_payment",
      createdAt: new Date(),
      expiresAt,
      clicks:    0
    });

    const msg = encodeURIComponent(
      `⭐ *ZiBuy Ad Boost Request*\n\n` +
      `Product ID: ${productId}\n` +
      `Plan: ${days} Days\n` +
      `Amount: *UGX ${price.toLocaleString()}*\n\n` +
      `User: ${currentUser.email}\n\n` +
      `Please confirm payment to activate boost.`
    );

    window.open(`https://wa.me/${ZIBUY_WHATSAPP}?text=${msg}`, "_blank");

    document.querySelectorAll(".modal").forEach(m => m.remove());
    alert("✅ Boost request sent! We'll activate it after payment confirmation on WhatsApp.");

  } catch (err) {
    console.error(err);
    alert("Boost request failed. Try again.");
  }
};

window.selectBoost = function(el, productId, days, price) {
  document.querySelectorAll(".boost-option input").forEach(r => r.checked = false);
  el.querySelector("input").checked = true;
  window.selectedBoost = { productId, days, price };
};

window.processBoost = async function() {
  if (!window.selectedBoost) {
    alert("Select a plan");
    return;
  }

  const success = await boostAd(
    window.selectedBoost.productId,
    window.selectedBoost.days,
    window.selectedBoost.price
  );

  if (success) {
    alert("✅ Ad boosted! Refresh to see changes.");
    window.location.reload();
  } else {
    alert("Boost failed");
  }
};