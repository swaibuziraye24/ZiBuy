import { db, auth, collection, getDocs, doc, updateDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  // Check if admin
  if (!user || user.email !== "swaibuziraye22@gmail.com") {
    alert("❌ Admin access only");
    window.location.href = "index.html";
    return;
  }
  
  loadBoostRequests();
});

async function loadBoostRequests() {
  try {
    const snapshot = await getDocs(collection(db, "boost_requests"));
    
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const container = document.getElementById("boost-requests-list");
    
    if (requests.length === 0) {
      container.innerHTML = `<p style="text-align:center;padding:40px;color:#6b7280;grid-column:1/-1">No boost requests</p>`;
      return;
    }

    container.innerHTML = requests.map(req => `
      <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <h3 style="margin:0 0 8px;color:#ff6600">${req.productName}</h3>
        <p style="margin:6px 0;color:#6b7280"><strong>User:</strong> ${req.userEmail}</p>
        <p style="margin:6px 0;color:#6b7280"><strong>Plan:</strong> ${req.days} Days - UGX ${req.price.toLocaleString()}</p>
        <p style="margin:6px 0;color:#6b7280"><strong>Status:</strong> <span style="background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:6px;font-weight:700">${req.status}</span></p>
        <p style="margin:12px 0 0;font-size:12px;color:#adb5bd">Request ID: ${req.id}</p>
        
        ${req.status === "pending" ? `
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn btn-orange" onclick="approveBoost('${req.id}', '${req.productId}')" style="flex:1;padding:10px;font-size:13px">✅ Approve</button>
            <button class="btn" style="flex:1;padding:10px;font-size:13px;background:#ef4444;color:white;border:none" onclick="rejectBoost('${req.id}')">❌ Reject</button>
          </div>
        ` : `
          <div style="margin-top:14px;padding:10px;background:#f3f4f6;border-radius:10px;text-align:center;font-size:13px;color:#6b7280">
            ${req.status === "approved" ? "✅ Approved" : "❌ Rejected"}
          </div>
        `}
      </div>
    `).join("");

  } catch (err) {
    console.error("Error loading boost requests:", err);
    document.getElementById("boost-requests-list").innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}

window.approveBoost = async function(boostRequestId, productId) {
  if (!confirm("Approve this boost request?")) return;

  try {
    // Update boost request status
    await updateDoc(doc(db, "boost_requests", boostRequestId), {
      status: "approved",
      approvedAt: new Date()
    });

    // Update product to mark as premium
    await updateDoc(doc(db, "products", productId), {
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Adjust based on days
    });

    alert("✅ Boost approved! Product is now featured.");
    loadBoostRequests();
  } catch (err) {
    alert("❌ Error: " + err.message);
  }
};

window.rejectBoost = async function(boostRequestId) {
  if (!confirm("Reject this boost request?")) return;

  try {
    await updateDoc(doc(db, "boost_requests", boostRequestId), {
      status: "rejected"
    });

    alert("❌ Boost request rejected.");
    loadBoostRequests();
  } catch (err) {
    alert("❌ Error: " + err.message);
  }
};