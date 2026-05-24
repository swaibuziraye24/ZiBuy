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

  const name = document.getElementById("verify-name").value.trim();

  const phone = document.getElementById("verify-phone").value.trim();

  const location = document.getElementById("verify-location").value.trim();

  const nationalId = document.getElementById("verify-national-id").value.trim();

  const about = document.getElementById("verify-about").value.trim();

  if (!name || !phone || !nationalId) {

    alert("Please fill all required fields");

    return;
  }

  try {

    // Prevent duplicates
    const q = query(
      collection(db, "verifications"),
      where("email", "==", currentUser.email)
    );

    const existing = await getDocs(q);

    if (!existing.empty) {

      alert("You already submitted a verification request");

      return;
    }

    // Submit request
    await addDoc(collection(db, "verifications"), {

      uid: currentUser.uid,

      email: currentUser.email,

      fullName: name,

      phone: phone,

      location: location,

      nationalId: nationalId,

      about: about,

      status: "pending",

      verified: false,

      createdAt: new Date()

    });

    alert("Verification submitted successfully ✅");

    location.reload();

  } catch (err) {

    console.error(err);

    alert("Failed to submit verification");

  }

};