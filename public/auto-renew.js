import { db, auth, collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where } from "./firebase.js";

const AUTO_RENEW_PRICE = 2000; // UGX per 30 days
const ADMIN_WHATSAPP    = "256789157512";

window.openAutoRenewModal = function(productId, productName) {
  const existing = document.getElementById("auto-renew-modal");
  if (existing) existing.remove();

  const orderRef = `RENEW-${productId.slice(0,8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const modal = document.createElement("div");
  modal.id = "auto-renew-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">🔄 Auto-Renew Ad</h2>
        <button onclick="document.getElementById('auto-renew-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <div style="background:linear-gradient(135deg,#fff4ee,#fffbeb);border:2px solid #ff6600;border-radius:14px;padding:16px;margin-bottom:16px">
        <p style="margin:0 0 6px;font-weight:800;color:#ff6600;font-size:15px">Never let this ad expire</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.5">
          "${productName}" will auto-renew every 30 days for <strong>UGX ${AUTO_RENEW_PRICE.toLocaleString()}/month</strong>.
          Cancel anytime — no long-term commitment.
        </p>
      </div>

      <div style="border:2px solid #ffcc00;border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ffcc00;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:#111">MTN</div>
          <span style="font-weight:800;font-size:14px">MTN Mobile Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ff6600">*165#</strong></li>
          <li>Select <strong>Pay With Momo</strong></li>
          <li>Merchant Code: <strong style="color:#ff6600;font-size:15px">27868095</strong></li>
          <li>Amount: <strong style="color:#ff6600">UGX ${AUTO_RENEW_PRICE.toLocaleString()}</strong></li>
          <li>Reference: <strong style="color:#ff6600">${orderRef}</strong></li>
        </ol>
      </div>

      <div style="border:2px solid #ef4444;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="background:#ef4444;border-radius:6px;padding:4px 8px;font-weight:900;font-size:12px;color:white">AIRTEL</div>
          <span style="font-weight:800;font-size:14px">Airtel Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ef4444">*185#</strong></li>
          <li>Select <strong>Send Money</strong></li>
          <li>Send to: <strong style="color:#ef4444;font-size:15px">+256575996624</strong></li>
          <li>Amount: <strong style="color:#ef4444">UGX ${AUTO_RENEW_PRICE.toLocaleString()}</strong></li>
          <li>Reference: <strong style="color:#ef4444">${orderRef}</strong></li>
        </ol>
      </div>

      <label style="display:block;font-size:12px;font-weight:800;color:#111827;margin-bottom:8px">
        Transaction ID after paying
      </label>
      <input type="text" id="ar-txn-ref" placeholder="e.g. 1234567890"
        style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:14px">

      <button id="ar-submit-btn" onclick="requestAutoRenew('${productId}','${productName.replace(/'/g,"\\'")}','${orderRef}')"
        style="width:100%;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        📲 I've Paid — Activate Auto-Renew
      </button>
      <p id="ar-error" style="color:#ef4444;font-size:13px;margin-top:10px;display:none"></p>
    </div>
  `;

  document.body.appendChild(modal);
};

window.requestAutoRenew = async function(productId, productName, orderRef) {
  if (!auth.currentUser) { alert("Please login first"); return; }

  const txnInput = document.getElementById("ar-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";
  const errorEl  = document.getElementById("ar-error");
  const btn      = document.getElementById("ar-submit-btn");

  if (!txnRef) {
    if (errorEl) { errorEl.textContent = "Please enter your transaction ID"; errorEl.style.display = "block"; }
    return;
  }

  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await addDoc(collection(db, "auto_renewals"), {
      productId,
      productName,
      userId:         auth.currentUser.uid,
      userEmail:      auth.currentUser.email,
      price:          AUTO_RENEW_PRICE,
      paymentRef:     orderRef,
      transactionRef: txnRef,
      status:         "pending_verification",
      expiresAt:      expiresAt,
      createdAt:      new Date()
    });

    document.getElementById("auto-renew-modal")?.remove();

    const waMsg = encodeURIComponent(
      `🔄 *Auto-Renew Request*\n\n` +
      `Ad: *${productName}*\n` +
      `Amount: *UGX ${AUTO_RENEW_PRICE.toLocaleString()}*\n` +
      `Reference: *${orderRef}*\n` +
      `Transaction ID: *${txnRef}*\n` +
      `Seller: *${auth.currentUser.email}*\n\n` +
      `Please verify and activate auto-renew for this ad.`
    );

    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${waMsg}`, "_blank");

    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "✅ Request sent! Admin will activate shortly.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = "Failed to submit. Try again."; errorEl.style.display = "block"; }
  } finally {
    if (btn) { btn.textContent = "📲 I've Paid — Activate Auto-Renew"; btn.disabled = false; }
  }
};

window.cancelAutoRenew = async function(productId, renewalId) {
  if (!confirm("Cancel auto-renew? Your ad will expire normally after its current period ends.")) return;

  try {
    await updateDoc(doc(db, "auto_renewals", renewalId), { status: "cancelled" });
    await updateDoc(doc(db, "products", productId), { autoRenew: false });
    alert("Auto-renew cancelled.");
    if (typeof window.loadUserAds === "function") window.loadUserAds();
  } catch (err) {
    console.error(err);
    alert("Failed to cancel. Try again.");
  }
};