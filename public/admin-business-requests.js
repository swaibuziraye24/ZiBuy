import { db, auth, collection, getDocs, updateDoc, doc, addDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

onAuthStateChanged(auth, (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "index.html";
    return;
  }
  loadRequests();
});

async function loadRequests() {
  const container = document.getElementById("requests-container");

  try {
    const snapshot = await getDocs(collection(db, "business_requests"));

    if (snapshot.empty) {
      container.innerHTML = "<p style='text-align:center;color:#6b7280;padding:40px'>No requests</p>";
      return;
    }

    container.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const req = docSnap.data();
      
      container.innerHTML += `
        <div class="request-card">
          <div class="request-header">
            <div>
              <h3>${req.businessName}</h3>
              <p style="color:#6b7280">${req.email}</p>
            </div>
            <span class="status-badge ${req.status}">${req.status.toUpperCase()}</span>
          </div>

          <div class="request-details">
            <p><strong>Category:</strong> ${req.category}</p>
            <p><strong>Location:</strong> ${req.location}</p>
            <p><strong>Phone:</strong> ${req.phone}</p>
            <p><strong>Description:</strong> ${req.description}</p>
            <p style="font-size:12px;color:#6b7280">Request ID: ${req.requestId}</p>
          </div>

          ${req.status === "pending" ? `
            <div class="request-actions">
              <button class="btn btn-orange" onclick="approveBusiness('${docSnap.id}', '${req.userId}', '${req.email}', '${req.businessName}')">
                ✅ Approve
              </button>
              <button class="btn btn-outline" onclick="rejectBusiness('${docSnap.id}')">
                ❌ Reject
              </button>
            </div>
          ` : ""}
        </div>
      `;
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}

window.approveBusiness = async function(requestId, userId, email, businessName) {
  try {
    // 1. Update request
    await updateDoc(doc(db, "business_requests", requestId), {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: ADMIN_EMAIL
    });

    // 2. Update user account
    const usersSnap = await getDocs(collection(db, "users"));
    for (const userDoc of usersSnap.docs) {
      if (userDoc.data().email === email) {
        await updateDoc(doc(db, "users", userDoc.id), {
          accountType: "business",
          businessApproved: true,
          adsLimit: 50
        });
        break;
      }
    }

    // 3. Create shop profile
    await addDoc(collection(db, "business_profiles"), {
      userId: userId,
      userEmail: email,
      shopName: businessName,
      followers: 0,
      rating: 0,
      totalReviews: 0,
      totalProducts: 0,
      totalSales: 0,
      responseTime: 0,
      trustScore: 100,
      verified: true,
      verifiedAt: new Date(),
      status: "active",
      createdAt: new Date()
    });

    alert("✅ Business account approved!");
    loadRequests();

  } catch (err) {
    alert("❌ Error: " + err.message);
  }
};

window.rejectBusiness = async function(requestId) {
  if (!confirm("Reject this business request?")) return;

  try {
    await updateDoc(doc(db, "business_requests", requestId), {
      status: "rejected",
      rejectedAt: new Date()
    });

    alert("❌ Request rejected");
    loadRequests();

  } catch (err) {
    alert("Error: " + err.message);
  }
};