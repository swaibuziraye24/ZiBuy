import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  query,
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
      paymentAmount: 50000,
      paymentStatus: "pending",
      status: "pending",
      createdAt: new Date()
    });

    // ========== WHATSAPP MESSAGE TO ADMIN ==========
    const adminWhatsApp = "256790548910"; // ⭐ REPLACE WITH YOUR NUMBER
    const verificationDetails = `
🎉 *New Seller Verification Received!*

📝 *Seller Information:*
- Name: ${fullName}
- Business: ${businessName}
- Email: ${currentUser.email}
- Phone: ${phone}
- Location: ${location}

💰 *Payment:*
- Amount: UGX 50,000
- Status: Pending Confirmation

📄 *Documents:*
- ID Document: ${idDocURL ? "✅ Uploaded" : "❌ Missing"}
- Business License: ${licenseURL ? "✅ Uploaded" : "⚠️ Optional"}

🔗 *Admin Action Required:*
Approve or Reject in Admin Panel:
https://zibuy-5deae.web.app/admin-verification.html

⏳ *Verification ID:* ${docRef.id}
    `;

    const whatsappURL = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(verificationDetails)}`;

    // Show success message
    alert("✅ Verification submitted! Opening WhatsApp to confirm payment...");

    // Open WhatsApp
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