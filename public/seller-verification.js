import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  query,
  doc, 
  updateDoc,
  where
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { db, auth, storage, collection, getDocs, addDoc, query, where } from "./firebase.js";

let currentUser = null;

// ============================================
// AUTH CHECK
// ============================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href = "index.html";

    return;
  }

  currentUser = user;

  checkExistingVerification();

});

// ============================================
// CHECK EXISTING REQUEST
// ============================================

async function checkExistingVerification() {

  const statusBox = document.getElementById("verification-status");

  try {

    const q = query(
      collection(db, "verifications"),
      where("email", "==", currentUser.email)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {

      const data = snapshot.docs[0].data();

      statusBox.innerHTML = `
        <div class="verification-status-box ${data.status}">
          Current Status:
          <strong>${data.status.toUpperCase()}</strong>
        </div>
      `;

    }

  } catch (err) {

    console.error(err);

  }

}

// ============================================
// SUBMIT VERIFICATION
// ============================================

window.submitVerification = async function() {
  const fullName = document.getElementById("full-name").value.trim();

  // Show payment requirement first
  const existingFeeNotice = document.getElementById("verif-fee-notice");
  if (!existingFeeNotice) {
    const notice = document.createElement("div");
    notice.id = "verif-fee-notice";
    notice.style.cssText = "background:#fff4ee;border:2px solid #ff6600;border-radius:12px;padding:16px;margin-bottom:16px";
    notice.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:15px;font-weight:800;color:#ff6600">💳 Verification Fee: UGX 10,000</h3>
      <p style="font-size:13px;color:#374151;margin-bottom:10px">Pay once to get your ✅ Verified badge permanently.</p>
      <div style="background:white;border:1.5px solid #ffcc00;border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px">
        <strong>MTN:</strong> Dial *165# → Pay With Momo → Code <strong style="color:#ff6600">27868095</strong> → UGX 10,000 → Ref: <strong style="color:#ff6600">VERIFY-${auth.currentUser?.uid?.slice(0,6).toUpperCase()}</strong>
      </div>
      <div style="background:white;border:1.5px solid #ef4444;border-radius:8px;padding:10px;font-size:13px">
        <strong>Airtel:</strong> Dial *185# → Send Money → <strong style="color:#ef4444">+256575996624</strong> → UGX 10,000 → Ref: <strong style="color:#ef4444">VERIFY-${auth.currentUser?.uid?.slice(0,6).toUpperCase()}</strong>
      </div>
    `;
    document.querySelector(".verification-form").prepend(notice);
    return; // Stop here first time — user reads payment instructions
  }
  const businessName = document.getElementById("business-name").value.trim();
  const phone = document.getElementById("phone-number").value.trim();
  const location = document.getElementById("location").value;
  const bio = document.getElementById("bio").value.trim();
  const idDoc = document.getElementById("id-document").files[0];
  const licenseDoc = document.getElementById("business-license").files[0];

  // Validation
  if (!fullName || !businessName || !phone || !location || !idDoc) {
    alert("❌ Please fill all required fields and upload ID document");
    return;
  }

  const btn = event.target;
  btn.textContent = "Submitting...";
  btn.disabled = true;

  try {
    // Check for duplicate
    const q = query(
      collection(db, "seller_verifications"),
      where("email", "==", currentUser.email)
    );

    const existing = await getDocs(q);

    if (!existing.empty && existing.docs[0].data().status === "pending") {
      alert("⏳ You already have a pending verification request");
      btn.textContent = "Submit for Verification";
      btn.disabled = false;
      return;
    }

    // Upload ID document
    const idRef = ref(storage, `seller-verification/${currentUser.uid}/id-${Date.now()}`);
    await uploadBytes(idRef, idDoc);
    const idDocURL = await getDownloadURL(idRef);

    // Upload business license if provided
    let licenseURL = null;
    if (licenseDoc) {
      const licenseRef = ref(storage, `seller-verification/${currentUser.uid}/license-${Date.now()}`);
      await uploadBytes(licenseRef, licenseDoc);
      licenseURL = await getDownloadURL(licenseRef);
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, "seller_verifications"), {
      userId: currentUser.uid,
      email: currentUser.email,
      fullName,
      businessName,
      phone,
      location,
      bio,
      idDocument: idDocURL,
      businessLicense: licenseURL,
      paymentAmount: 100000,
      paymentStatus: "pending",
      status: "pending",
      createdAt: new Date()
    });

    // ========== WHATSAPP MESSAGE TO ADMIN ==========
    const adminWhatsApp = "256790548910"; // ⭐ REPLACE WITH YOUR NUMBER
   // Ask for transaction reference before sending to WhatsApp
    const txnRef = prompt(
      "✅ Documents uploaded!\n\n" +
      "Enter your MTN/Airtel transaction ID after paying UGX 10,0000:\n" +
      "(Check your phone for the confirmation SMS)"
    );

    if (!txnRef || !txnRef.trim()) {
      alert("⚠️ Please enter your transaction ID to complete verification.");
      btn.textContent = "Submit for Verification";
      btn.disabled = false;
      return;
    }

    // Save transaction ref to Firestore
    await updateDoc(doc(db, "seller_verifications", docRef.id), {
      transactionRef:  txnRef.trim(),
      paymentAmount:   100000,
      paymentStatus:   "pending_verification"
    });

    const verifRef = `VERIFY-${currentUser.uid.slice(0,6).toUpperCase()}`;

    const verificationDetails =
      `🎉 *New Seller Verification Request*\n\n` +
      `👤 *Seller Details:*\n` +
      `• Name: ${fullName}\n` +
      `• Business: ${businessName}\n` +
      `• Email: ${currentUser.email}\n` +
      `• Phone: ${phone}\n` +
      `• Location: ${location}\n\n` +
      `💰 *Payment:*\n` +
      `• Amount: UGX 100,000\n` +
      `• Reference Code: ${verifRef}\n` +
      `• Transaction ID: ${txnRef.trim()}\n\n` +
      `📄 *Documents:*\n` +
      `• ID: ${idDocURL ? "✅ Uploaded" : "❌ Missing"}\n` +
      `• License: ${licenseURL ? "✅ Uploaded" : "⚠️ Not provided"}\n\n` +
      `🔗 Approve/Reject: https://zibuy-5deae.web.app/admin.html\n` +
      `🆔 Verification ID: ${docRef.id}`;

    const whatsappURL = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(verificationDetails)}`;

    alert("✅ Verification submitted! Opening WhatsApp to notify admin...");
    window.open(whatsappURL, "_blank");

    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 2000);

  } catch (err) {
    console.error("Verification error:", err);
    alert("❌ Submission failed: " + err.message);
    btn.textContent = "Submit for Verification";
    btn.disabled = false;
  }
};