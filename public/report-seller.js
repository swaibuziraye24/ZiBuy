import { db, auth, collection, addDoc } from "./firebase.js";

const ADMIN_WHATSAPP = "256789157512";

window.openReportModal = function(sellerId, sellerName, productId, productName) {
  const existing = document.getElementById("report-seller-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "report-seller-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">🚩 Report Seller</h2>
        <button onclick="document.getElementById('report-seller-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <div style="background:#fff4ee;border-radius:10px;padding:12px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#6b7280">Reporting</p>
        <p style="margin:2px 0 0;font-weight:800;color:#111827">${sellerName}</p>
        ${productName ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280">Product: ${productName}</p>` : ""}
      </div>

      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        Reason
      </label>
      <select id="report-reason" style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;margin-bottom:14px">
        <option value="Scam / Fraud">Scam / Fraud</option>
        <option value="Fake or Counterfeit Product">Fake or Counterfeit Product</option>
        <option value="Item Already Sold">Item Already Sold but Still Listed</option>
        <option value="Wrong Category / Spam">Wrong Category / Spam</option>
        <option value="Offensive Content">Offensive Content</option>
        <option value="Seller Not Responding">Seller Not Responding</option>
        <option value="Other">Other</option>
      </select>

      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        Details
      </label>
      <textarea id="report-description" rows="4" placeholder="Describe what happened..."
        style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:16px;resize:none"></textarea>

      <button id="report-submit-btn" onclick="submitSellerReport('${sellerId || ""}','${(sellerName || "Seller").replace(/'/g,"\\'")}','${productId || ""}','${(productName || "").replace(/'/g,"\\'")}')"
        style="width:100%;background:#ef4444;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        📲 Submit Report
      </button>

      <p style="font-size:11px;color:#9ca3af;margin-top:10px;text-align:center">
        This report will be sent to ZiBuy admin for review, and a WhatsApp message will open so you can follow up directly.
      </p>
    </div>
  `;

  document.body.appendChild(modal);
};

window.submitSellerReport = async function(sellerId, sellerName, productId, productName) {
  if (!auth.currentUser) {
    alert("Please login to submit a report");
    return;
  }

  const reason      = document.getElementById("report-reason")?.value || "Other";
  const description = document.getElementById("report-description")?.value.trim() || "";

  if (!description) {
    alert("Please describe what happened");
    return;
  }

  const btn = document.getElementById("report-submit-btn");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    await addDoc(collection(db, "reports"), {
      reason,
      description,
      sellerId:      sellerId || "",
      sellerName:    sellerName || "Unknown Seller",
      productId:     productId || "",
      productRef:    productName || "",
      reporterEmail: auth.currentUser.email,
      reportedBy:    auth.currentUser.email,
      status:        "open",
      createdAt:     new Date()
    });

    document.getElementById("report-seller-modal")?.remove();

    // Build WhatsApp message to admin
    const waMsg = encodeURIComponent(
      `🚩 *New ZiBuy Report*\n\n` +
      `Seller: *${sellerName}*\n` +
      (productName ? `Product: *${productName}*\n` : "") +
      `Reason: *${reason}*\n\n` +
      `Details:\n${description}\n\n` +
      `Reported by: ${auth.currentUser.email}`
    );

    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${waMsg}`, "_blank");

    // Show confirmation
    const toast = document.createElement("div");
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:#10b981;color:white;padding:12px 24px;border-radius:10px;
      font-weight:700;font-size:14px;z-index:99999;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);text-align:center`;
    toast.textContent = "✅ Report submitted. Admin has been notified.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);

  } catch (err) {
    console.error("Report submission failed:", err);
    alert("Failed to submit report. Please try again.");
    if (btn) { btn.textContent = "📲 Submit Report"; btn.disabled = false; }
  }
};