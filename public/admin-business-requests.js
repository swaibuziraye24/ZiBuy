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
    const { addDoc } = await import("./firebase.js");
    
    // Get the request data
    const requestSnap = await getDocs(collection(db, "business_requests"));
    let businessData = null;
    let userDocId = null;

    for (const doc of requestSnap.docs) {
      if (doc.id === requestId) {
        businessData = doc.data();
        break;
      }
    }

    if (!businessData) {
      alert("❌ Request not found");
      return;
    }

    // 1. Approve the business request
    await updateDoc(doc(db, "business_requests", requestId), {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: "swaibuziraye22@gmail.com"
    });

    // 2. Update user account
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.email === businessData.email) {
        await updateDoc(doc(db, "users", userDoc.id), {
          accountType: "business",
          businessApproved: true,
          subscriptionActive: true,
          maxAds: 50,  // Business can post 50 ads
          businessActivatedAt: new Date()
        });
        userDocId = userDoc.id;
        break;
      }
    }

    // 3. Create business shop profile
    const shopProfile = {
      userId: userId,
      userEmail: businessData.email,
      shopName: businessData.shopName || businessData.businessName,
      description: businessData.description || "",
      category: businessData.category || "General",
      logo: businessData.logo || "https://via.placeholder.com/150?text=Shop+Logo",
      banner: businessData.banner || "https://via.placeholder.com/1200x300?text=Shop+Banner",
      location: businessData.location || "",
      phone: businessData.phone || "",
      website: businessData.website || "",
      
      // Stats
      followers: 0,
      rating: 0,
      totalReviews: 0,
      totalProducts: 0,
      totalSales: 0,
      responseTime: 0,
      trustScore: 100,
      
      // Status
      verified: true,
      verifiedAt: new Date(),
      status: "active",
      createdAt: new Date()
    };

    await addDoc(collection(db, "business_profiles"), shopProfile);

    alert("✅ Business account approved!\n\n Shop profile created.\n Seller can now post up to 50 ads.");
    loadRequests();

  } catch (err) {
    console.error("Approval error:", err);
    alert("❌ Approval failed: " + err.message);
  }
};