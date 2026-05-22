import { db, auth, storage, collection, addDoc, getDocs, query, where, setDoc, doc } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  checkExistingVerification();
});

async function checkExistingVerification() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", currentUser.uid)
    ));

    if (!snapshot.empty) {
      const verification = snapshot.docs[0].data();
      document.querySelector(".verification-form").style.display = "none";
      document.getElementById("verification-status").style.display = "block";
      
      const statusMap = {
        pending: "⏳ Pending Review",
        approved: "✅ Verified",
        rejected: "❌ Rejected"
      };
      
      document.getElementById("status-text").textContent = statusMap[verification.status] || verification.status;
    }
  } catch (err) {
    console.error(err);
  }
}

window.submitVerification = async function() {
  const fullName = document.getElementById("full-name").value.trim();
  const businessName = document.getElementById("business-name").value.trim();
  const phone = document.getElementById("phone-number").value.trim();
  const location = document.getElementById("location").value;
  const bio = document.getElementById("bio").value.trim();
  const idDoc = document.getElementById("id-document").files[0];

  if (!fullName || !businessName || !phone || !location || !idDoc) {
    alert("Fill all required fields");
    return;
  }

  const btn = event.target;
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    // Upload ID document
    const idRef = ref(storage, `seller-verification/${currentUser.uid}/id-${Date.now()}`);
    await uploadBytes(idRef, idDoc);
    const idUrl = await getDownloadURL(idRef);

    // Upload business license if provided
    let licenseUrl = null;
    const licenseDoc = document.getElementById("business-license").files[0];
    if (licenseDoc) {
      const licenseRef = ref(storage, `seller-verification/${currentUser.uid}/license-${Date.now()}`);
      await uploadBytes(licenseRef, licenseDoc);
      licenseUrl = await getDownloadURL(licenseRef);
    }

    // Create verification request
    await addDoc(collection(db, "seller_verifications"), {
      userId: currentUser.uid,
      email: currentUser.email,
      fullName,
      businessName,
      phone,
      location,
      bio,
      idDocument: idUrl,
      businessLicense: licenseUrl,
      status: "pending",
      createdAt: new Date()
    });

    // Update user seller info
    await setDoc(doc(db, "users", currentUser.uid), {
      isSellerVerified: false,
      sellerVerificationStatus: "pending",
      lastVerificationSubmit: new Date()
    }, { merge: true });

    document.querySelector(".verification-form").style.display = "none";
    document.getElementById("verification-status").style.display = "block";
    document.getElementById("status-text").textContent = "⏳ Pending Review";
    alert("Verification submitted! Check back in 24-48 hours.");

  } catch (err) {
    console.error(err);
    alert("Submission failed");
    btn.textContent = "Submit for Verification";
    btn.disabled = false;
  }
};