// ============================================
//   ZiBuy — Seller Verification
// ============================================

import { db, auth, storage, collection, addDoc, getDocs, query, where, doc, updateDoc } from "./firebase.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


import { getDistricts } from "./uganda-locations.js";
import "./uganda-locations.js"; // registers updateSubLocations on window

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("location-district");
  if (el) {
    getDistricts().forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      el.appendChild(opt);
    });
  }
});

let currentUser = null;

// ── Auth check ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  // Set payment reference in UI
  const verifRef = `VERIFY-${user.uid.slice(0, 6).toUpperCase()}`;
  const mtnEl    = document.getElementById("mtn-ref");
  const airtelEl = document.getElementById("airtel-ref");
  if (mtnEl)    mtnEl.textContent    = verifRef;
  if (airtelEl) airtelEl.textContent = verifRef;

  // Check if already submitted
  await checkExistingVerification();
});

// ── Check existing verification ───────────────
async function checkExistingVerification() {
  try {
    const snap = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", currentUser.uid)
    ));

    if (snap.empty) return;

    const data   = snap.docs[0].data();
    const status = data.status || "pending";

    const statusColors = {
      pending:  { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "⏳" },
      approved: { bg: "#f0fdf4", border: "#86efac", color: "#166534", icon: "✅" },
      rejected: { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", icon: "❌" }
    };
    const s = statusColors[status] || statusColors.pending;

    // Hide form, show status
    document.getElementById("verify-form-wrap").style.display = "none";
    const statusBox = document.getElementById("verification-status");
    statusBox.style.display = "block";
    statusBox.innerHTML = `
      <div style="background:${s.bg};border:2px solid ${s.border};border-radius:16px;padding:24px;text-align:center">
        <p style="font-size:48px;margin:0 0 12px">${s.icon}</p>
        <h2 style="font-size:20px;font-weight:800;color:${s.color};margin:0 0 8px">
          Verification ${status.charAt(0).toUpperCase() + status.slice(1)}
        </h2>
        ${status === "pending"
          ? `<p style="color:${s.color};font-size:14px;margin:0">
               Your request is being reviewed. Admin will respond within <strong>24 hours</strong>.
             </p>`
          : ""}
        ${status === "approved"
          ? `<p style="color:${s.color};font-size:14px;margin:0">
               🎉 Congratulations! You are now a <strong>Verified Seller</strong> on ZiBuy.
             </p>`
          : ""}
        ${status === "rejected"
          ? `<p style="color:${s.color};font-size:14px;margin:0 0 8px">
               ${data.rejectionReason || "Your request was not approved."}
             </p>
             <p style="color:${s.color};font-size:13px;margin:0">
               Contact admin on WhatsApp: <strong>+256789157512</strong>
             </p>`
          : ""}
        <button onclick="window.location.href='dashboard.html'"
          style="margin-top:20px;background:#ff6600;color:white;border:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">
          ← Back to Dashboard
        </button>
      </div>
    `;
  } catch (err) {
    console.error("checkExistingVerification error:", err);
  }
}

// ── Submit verification ───────────────────────
window.submitVerification = async function() {
  const fullName     = document.getElementById("full-name").value.trim();
  const businessName = document.getElementById("business-name").value.trim();
  const phone        = document.getElementById("phone-number").value.trim();
  const district = document.getElementById("location-district")?.value || "";
  const subLoc   = document.getElementById("location-sublocation")?.value || "";
  const location = subLoc ? `${subLoc}, ${district}` : district;
  const bio          = document.getElementById("bio").value.trim();
  const idDoc        = document.getElementById("id-document").files[0];
  const txnRef       = document.getElementById("verif-txn-ref").value.trim();

  if (!fullName || !businessName || !phone || !location || !idDoc) {
    alert("Fill all required fields");
    return;
  }

  if (!txnRef) {
    const txnInput = document.getElementById("verif-txn-ref");
    txnInput.style.borderColor = "#ef4444";
    txnInput.focus();
    alert("Please enter your transaction ID after paying UGX 50,000");
    return;
  }

  if (!idDoc) {
    alert("❌ Please upload your ID document");
    return;
  }

  const btn = document.getElementById("submit-btn");
  btn.textContent = "Uploading documents...";
  btn.disabled    = true;

  try {
    // Check duplicate
    const existing = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "pending")
    ));

    if (!existing.empty) {
      alert("⏳ You already have a pending verification request.");
      btn.textContent = "📲 Submit & Send Reference to Admin WhatsApp";
      btn.disabled    = false;
      return;
    }

    // Upload ID
    btn.textContent = "Uploading ID document...";
    const idRef  = ref(storage, `seller-verification/${currentUser.uid}/id-${Date.now()}`);
    await uploadBytes(idRef, idDoc);
    const idDocURL = await getDownloadURL(idRef);

    // Upload license if provided
    let licenseURL = null;
    if (licenseDoc) {
      btn.textContent = "Uploading business license...";
      const licRef = ref(storage, `seller-verification/${currentUser.uid}/license-${Date.now()}`);
      await uploadBytes(licRef, licenseDoc);
      licenseURL = await getDownloadURL(licRef);
    }

    btn.textContent = "Saving request...";

    const verifRef = `VERIFY-${currentUser.uid.slice(0, 6).toUpperCase()}`;

    // Save to Firestore
    const docRef = await addDoc(collection(db, "seller_verifications"), {
      userId:         currentUser.uid,
      email:          currentUser.email,
      fullName,
      businessName,
      phone,
      location,
      bio,
      idDocument:     idDocURL,
      businessLicense: licenseURL,
      transactionRef: txnRef,
      paymentRef:     verifRef,
      paymentAmount:  50000,
      paymentStatus:  "pending_verification",
      status:         "pending",
      createdAt:      new Date()
    });

    // Build WhatsApp message
    const waMsg =
      `🎉 *New Seller Verification Request*\n\n` +
      `👤 *Seller Details:*\n` +
      `• Name: *${fullName}*\n` +
      `• Business: *${businessName}*\n` +
      `• Email: *${currentUser.email}*\n` +
      `• Phone: *${phone}*\n` +
      `• Location: *${location}*\n\n` +
      `💰 *Payment:*\n` +
      `• Amount: *UGX 50,000*\n` +
      `• Reference Code: *${verifRef}*\n` +
      `• Transaction ID: *${txnRef}*\n\n` +
      `📄 *Documents:*\n` +
      `• ID: ${idDocURL ? "✅ Uploaded" : "❌ Missing"}\n` +
      `• License: ${licenseURL ? "✅ Uploaded" : "⚠️ Not provided"}\n\n` +
      `🔗 Approve/Reject: https://zibuy-5deae.web.app/admin.html\n` +
      `🆔 Verification ID: ${docRef.id}`;

    // Open admin WhatsApp
    window.open(`https://wa.me/256789157512?text=${encodeURIComponent(waMsg)}`, "_blank");

    // Show success screen
    document.getElementById("verify-form-wrap").style.display = "none";
    const statusBox = document.getElementById("verification-status");
    statusBox.style.display = "block";
    statusBox.innerHTML = `
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:32px;text-align:center">
        <p style="font-size:52px;margin:0 0 12px">✅</p>
        <h2 style="font-size:20px;font-weight:800;color:#166534;margin:0 0 8px">
          Verification Submitted!
        </h2>
        <p style="color:#166534;font-size:14px;margin:0 0 12px">
          Your reference has been sent to admin via WhatsApp.
        </p>
        <div style="background:white;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;text-align:left">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#6b7280">Reference Code</span>
            <strong style="color:#ff6600">${verifRef}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#6b7280">Transaction ID</span>
            <strong style="color:#ff6600">${txnRef}</strong>
          </div>
        </div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:20px">
          Admin will verify your payment and activate your badge within <strong>1 hour</strong>.
        </p>
        <button onclick="window.location.href='dashboard.html'"
          style="background:#ff6600;color:white;border:none;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
          Go to Dashboard →
        </button>
      </div>
    `;

  } catch (err) {
    console.error("Verification error:", err);
    alert("❌ Submission failed: " + err.message);
    btn.textContent = "📲 Submit & Send Reference to Admin WhatsApp";
    btn.disabled    = false;
  }
};