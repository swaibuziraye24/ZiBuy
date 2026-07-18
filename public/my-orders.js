import { db, auth, collection, getDocs, query, where, doc, updateDoc, addDoc } from "./firebase.js";

export async function loadMyOrders() {
  const container = document.getElementById("my-orders-list");
  if (!container || !auth.currentUser) return;

  container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:20px">Loading your orders...</p>`;

  try {
    const snap = await getDocs(query(
      collection(db, "orders"),
      where("buyerUid", "==", auth.currentUser.uid)
    ));

    const orders = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (orders.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:20px">No orders yet</p>`;
      return;
    }

    container.innerHTML = orders.map(o => {
      const statusBadge = {
        pending_verification: { bg: "#fef3c7", color: "#92400e", label: "⏳ Awaiting Confirmation" },
        confirmed:             { bg: "#dcfce7", color: "#166534", label: "✅ Confirmed" },
        disputed:               { bg: "#fee2e2", color: "#991b1b", label: "🚨 Disputed" },
        auto_confirmed:         { bg: "#dbeafe", color: "#1e40af", label: "✅ Auto-Confirmed" }
      }[o.disputeStatus === "open" ? "disputed" : (o.deliveryConfirmed ? (o.autoConfirmed ? "auto_confirmed" : "confirmed") : "pending_verification")];

      return `
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:12px;background:white">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">
            <p style="margin:0;font-weight:800;font-size:14px;color:#111827">${o.productName}</p>
            <span style="background:${statusBadge.bg};color:${statusBadge.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800">${statusBadge.label}</span>
          </div>
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Seller: ${o.sellerName || "—"}</p>
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#ff6600">UGX ${Number(o.total || o.price || 0).toLocaleString()}</p>

          ${o.protected && !o.deliveryConfirmed && o.disputeStatus !== "open" ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="confirmOrderReceipt('${o.id}')"
                style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">
                ✅ I Received This
              </button>
              <button onclick="openDisputeModal('${o.id}','${(o.productName||"").replace(/'/g,"\\'")}')"
                style="background:#fee2e2;color:#ef4444;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">
                🚨 Report a Problem
              </button>
            </div>` : ""}

          ${o.disputeStatus === "open" ? `
            <p style="margin:0;font-size:12px;color:#991b1b;background:#fee2e2;padding:8px;border-radius:8px">
              Your dispute is under review. Our team will contact you shortly.
            </p>` : ""}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("loadMyOrders:", err);
    container.innerHTML = `<p style="color:#ef4444;text-align:center;padding:20px">Failed to load orders</p>`;
  }
}

window.confirmOrderReceipt = async function(orderId) {
  if (!confirm("Confirm you received this item in good condition? This closes ZiBuy Protect coverage for this order.")) return;

  try {
    await updateDoc(doc(db, "orders", orderId), {
      deliveryConfirmed: true,
      confirmedAt:        new Date(),
      autoConfirmed:      false
    });

    // Refresh whichever UI is showing orders — dashboard's tab takes
    // priority if present, otherwise fall back to this module's own widget
    if (typeof window.refreshOrdersTab === "function") window.refreshOrdersTab();
    else loadMyOrders();

  } catch (err) {
    console.error(err);
    alert("Failed to confirm. Please try again.");
  }
};

window.openDisputeModal = function(orderId, productName) {
  const existing = document.getElementById("dispute-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "dispute-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:440px;width:100%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">🚨 Report a Problem</h2>
        <button onclick="document.getElementById('dispute-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <p style="font-size:13px;color:#6b7280;margin-bottom:14px">Order: <strong>${productName}</strong></p>

      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">What went wrong?</label>
      <select id="dispute-reason" style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;margin-bottom:14px">
        <option value="Item Not Received">Item Not Received</option>
        <option value="Item Different From Description">Item Different From Description</option>
        <option value="Item Damaged">Item Damaged</option>
        <option value="Seller Unresponsive">Seller Unresponsive</option>
        <option value="Other">Other</option>
      </select>

      <textarea id="dispute-details" rows="4" placeholder="Describe what happened..."
        style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:16px;resize:none"></textarea>

      <button id="dispute-submit-btn" onclick="submitDispute('${orderId}','${productName.replace(/'/g,"\\'")}')"
        style="width:100%;background:#ef4444;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        Submit Dispute
      </button>
      <p id="dispute-error" style="color:#ef4444;font-size:13px;margin-top:10px;display:none"></p>
    </div>
  `;
  document.body.appendChild(modal);
};

window.submitDispute = async function(orderId, productName) {
  const reason  = document.getElementById("dispute-reason")?.value || "Other";
  const details = document.getElementById("dispute-details")?.value.trim() || "";
  const errorEl = document.getElementById("dispute-error");
  const btn     = document.getElementById("dispute-submit-btn");

  if (!details) {
    if (errorEl) { errorEl.textContent = "Please describe the issue"; errorEl.style.display = "block"; }
    return;
  }

  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    await updateDoc(doc(db, "orders", orderId), {
      disputeStatus: "open",
      disputeReason: reason,
      disputedAt:    new Date()
    });

    await addDoc(collection(db, "disputes"), {
      orderId, productName, reason, details,
      buyerEmail: auth.currentUser.email,
      buyerUid:   auth.currentUser.uid,
      status:     "open",
      createdAt:  new Date()
    });

    document.getElementById("dispute-modal")?.remove();

    const waMsg = encodeURIComponent(
      `🚨 *New ZiBuy Protect Dispute*\n\n` +
      `Order: *${productName}*\n` +
      `Reason: *${reason}*\n\n` +
      `Details:\n${details}\n\n` +
      `Buyer: ${auth.currentUser.email}`
    );
    window.open(`https://wa.me/256789157512?text=${waMsg}`, "_blank");

    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#ef4444;color:white;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "🚨 Dispute submitted. Our team will review.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);

    if (typeof window.refreshOrdersTab === "function") window.refreshOrdersTab();
    else loadMyOrders();

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = "Failed to submit. Try again."; errorEl.style.display = "block"; }
  } finally {
    if (btn) { btn.textContent = "Submit Dispute"; btn.disabled = false; }
  }
};