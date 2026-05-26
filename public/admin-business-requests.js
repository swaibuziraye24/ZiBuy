import {
  db,
  auth,
  collection,
  getDocs,
  updateDoc,
  doc
} from "./firebase.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

onAuthStateChanged(auth, async (user) => {

  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "index.html";
    return;
  }

  loadRequests();

});

async function loadRequests() {

  const container = document.getElementById("business-requests");

  const snapshot = await getDocs(collection(db, "business_requests"));

  if (snapshot.empty) {
    container.innerHTML = `
      <p>No requests found</p>
    `;
    return;
  }

  container.innerHTML = "";

  snapshot.forEach((docSnap) => {

    const data = docSnap.data();

    container.innerHTML += `
      <div class="verification-request-card">

        <h3>${data.email}</h3>

        <p>Status: ${data.status}</p>

        <button
          onclick="approveBusiness('${docSnap.id}', '${data.userId}')"
          class="btn btn-orange"
        >
          ✅ Approve
        </button>

      </div>
    `;
  });
}

window.approveBusiness = async function(requestId, userId) {

  try {

    // Approve request
    await updateDoc(doc(db, "business_requests", requestId), {
      status: "approved"
    });

    // Update user account
    const usersSnapshot = await getDocs(collection(db, "users"));

    usersSnapshot.forEach(async (userDoc) => {

      const userData = userDoc.data();

      if (userData.userId === userId) {

        await updateDoc(doc(db, "users", userDoc.id), {
          accountType: "business",
          businessApproved: true,
          subscriptionActive: true,
          maxAds: 50
        });

      }

    });

    alert("✅ Business account approved");

    loadRequests();

  } catch (err) {
    console.error(err);
    alert("Approval failed");
  }

};