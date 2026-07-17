import { db, auth, collection, addDoc, getDocs, query, where, doc, updateDoc, getDoc } from "./firebase.js";

// ── Submit a rating from seller about a buyer ──
export async function submitBuyerRating(sellerId, buyerId, orderId, productId, rating, text) {
  if (!auth.currentUser || auth.currentUser.uid !== sellerId) {
    throw new Error("Only the seller of this order can rate the buyer");
  }

  // Prevent duplicate rating for the same order
  const existing = await getDocs(query(
    collection(db, "buyer_ratings"),
    where("orderId", "==", orderId),
    where("sellerId", "==", sellerId)
  ));
  if (!existing.empty) {
    throw new Error("You have already rated this buyer for this order");
  }

  await addDoc(collection(db, "buyer_ratings"), {
    sellerId,
    sellerEmail: auth.currentUser.email,
    buyerId,
    orderId,
    productId: productId || "",
    rating:    Number(rating),
    text:      (text || "").trim(),
    createdAt: new Date()
  });

  await recalculateBuyerRating(buyerId);

  await addDoc(collection(db, "notifications"), {
    userId:    buyerId,
    type:      "buyer_rating",
    title:     "⭐ You received a buyer rating",
    message:   `A seller rated you ${rating}/5 for a recent order.`,
    relatedId: orderId,
    read:      false,
    createdAt: new Date()
  });

  return true;
}

async function recalculateBuyerRating(buyerId) {
  const snap = await getDocs(query(
    collection(db, "buyer_ratings"),
    where("buyerId", "==", buyerId)
  ));

  let total = 0;
  let count = 0;
  snap.forEach(d => { total += Number(d.data().rating || 0); count++; });

  const avg = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;

  await updateDoc(doc(db, "users", buyerId), {
    buyerRating:      avg,
    buyerRatingCount: count
  }).catch(() => {});
}

export async function getBuyerRatingSummary(buyerId) {
  try {
    const userSnap = await getDoc(doc(db, "users", buyerId));
    if (!userSnap.exists()) return { avg: 0, count: 0 };
    const data = userSnap.data();
    return { avg: data.buyerRating || 0, count: data.buyerRatingCount || 0 };
  } catch (e) {
    return { avg: 0, count: 0 };
  }
}

// ── UI: modal for rating a buyer ──
window.openRateBuyerModal = function(sellerId, buyerId, buyerEmail, orderId, productId, productName) {
  const existing = document.getElementById("rate-buyer-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "rate-buyer-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:420px;width:100%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">⭐ Rate This Buyer</h2>
        <button onclick="document.getElementById('rate-buyer-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#6b7280">Buyer</p>
        <p style="margin:2px 0 0;font-weight:800;color:#111827">${buyerEmail}</p>
        ${productName ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280">Order: ${productName}</p>` : ""}
      </div>

      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
        How was this buyer?
      </label>
      <div style="display:flex;gap:6px;margin-bottom:16px" id="rb-star-row">
        ${[1,2,3,4,5].map(n => `
          <button type="button" data-val="${n}" onclick="selectBuyerRatingStar(${n})"
            style="flex:1;padding:12px 0;border:1.5px solid #e5e7eb;border-radius:10px;background:white;cursor:pointer;font-size:20px" class="rb-star-btn">
            ⭐
          </button>
        `).join("")}
      </div>
      <input type="hidden" id="rb-rating-value" value="5">

      <textarea id="rb-text" rows="3" placeholder="Optional: how was this buyer to deal with? (paid on time, easy communication, etc.)"
        style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:16px;resize:none"></textarea>

      <button id="rb-submit-btn" onclick="submitBuyerRatingFromModal('${sellerId}','${buyerId}','${orderId}','${productId || ""}')"
        style="width:100%;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        Submit Rating
      </button>
      <p id="rb-error" style="color:#ef4444;font-size:13px;margin-top:10px;display:none"></p>
    </div>
  `;

  document.body.appendChild(modal);
  window.selectBuyerRatingStar(5);
};

window.selectBuyerRatingStar = function(n) {
  document.getElementById("rb-rating-value").value = n;
  document.querySelectorAll(".rb-star-btn").forEach(btn => {
    const val = Number(btn.dataset.val);
    btn.style.background  = val <= n ? "#fff4ee" : "white";
    btn.style.borderColor = val <= n ? "#ff6600" : "#e5e7eb";
  });
};

window.submitBuyerRatingFromModal = async function(sellerId, buyerId, orderId, productId) {
  const rating  = document.getElementById("rb-rating-value")?.value || 5;
  const text    = document.getElementById("rb-text")?.value || "";
  const errorEl = document.getElementById("rb-error");
  const btn     = document.getElementById("rb-submit-btn");

  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    await submitBuyerRating(sellerId, buyerId, orderId, productId, rating, text);
    document.getElementById("rate-buyer-modal")?.remove();

    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "✅ Buyer rated successfully!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

    if (typeof window.loadSellerOrdersToRate === "function") {
      window.loadSellerOrdersToRate();
    }

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = err.message || "Failed to submit rating"; errorEl.style.display = "block"; }
  } finally {
    if (btn) { btn.textContent = "Submit Rating"; btn.disabled = false; }
  }
};