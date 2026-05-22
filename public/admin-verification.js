import { db, auth, collection, getDocs, query, where, updateDoc, doc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let allVerifications = [];
let currentFilter = "pending";
let selectedVerification = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user || user.email !== "swaibuziraye22@gmail.com") {
    window.location.href = "index.html";
    return;
  }
  loadVerifications();
});

async function loadVerifications() {
  try {
    const snapshot = await getDocs(collection(db, "seller_verifications"));
    allVerifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderVerifications();
  } catch (err) {
    console.error(err);
  }
}

function renderVerifications() {
  const container = document.getElementById("verification-requests");
  const filtered = allVerifications.filter(v => v.status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">No ${currentFilter} requests</p>`;
    return;
  }

  container.innerHTML = filtered.map(v => `
    <div class="verification-request-card" onclick="openVerifyModal('${v.id}')">
      <div>
        <h3>${v.businessName}</h3>
        <p>${v.fullName}</p>
        <p style="font-size:12px;color:#6b7280">${new Date(v.createdAt.toDate()).toLocaleDateString()}</p>
      </div>
      <span style="background:${v.status === 'approved' ? '#10b981' : v.status === 'rejected' ? '#ef4444' : '#f59e0b'};color:white;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700">
        ${v.status.toUpperCase()}
      </span>
    </div>
  `).join("");
}

window.filterVerifications = function(filter) {
  currentFilter = filter;
  document.querySelectorAll(".verify-filter").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  renderVerifications();
};

window.openVerifyModal = async function(verificationId) {
  selectedVerification = allVerifications.find(v => v.id === verificationId);
  if (!selectedVerification) return;

  document.getElementById("modal-seller-name").textContent = selectedVerification.businessName;
  
  const content = `
    <div style="display:flex;flex-direction:column;gap:12px;font-size:13px">
      <div>
        <p style="margin:0;font-weight:700">Full Name</p>
        <p style="margin:4px 0 0;color:#6b7280">${selectedVerification.fullName}</p>
      </div>
      <div>
        <p style="margin:0;font-weight:700">Business Name</p>
        <p style="margin:4px 0 0;color:#6b7280">${selectedVerification.businessName}</p>
      </div>
      <div>
        <p style="margin:0;font-weight:700">Phone</p>
        <p style="margin:4px 0 0;color:#6b7280">${selectedVerification.phone}</p>
      </div>
      <div>
        <p style="margin:0;font-weight:700">Location</p>
        <p style="margin:4px 0 0;color:#6b7280">${selectedVerification.location}</p>
      </div>
      <div>
        <p style="margin:0;font-weight:700">Bio</p>
        <p style="margin:4px 0 0;color:#6b7280">${selectedVerification.bio}</p>
      </div>
      <div>
        <p style="margin:0;font-weight:700">ID Document</p>
        <a href="${selectedVerification.idDocument}" target="_blank" style="color:#ff6600;font-weight:700">View Image</a>
      </div>
      ${selectedVerification.businessLicense ? `
        <div>
          <p style="margin:0;font-weight:700">Business License</p>
          <a href="${selectedVerification.businessLicense}" target="_blank" style="color:#ff6600;font-weight:700">View Image</a>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById("modal-content").innerHTML = content;
  document.getElementById("modal-verify").classList.add("open");
};

window.closeVerifyModal = function() {
  document.getElementById("modal-verify").classList.remove("open");
  selectedVerification = null;
};

window.approveVerification = async function() {
  if (!selectedVerification) return;

  try {
    await updateDoc(doc(db, "seller_verifications", selectedVerification.id), {
      status: "approved",
      approvedAt: new Date()
    });

    await updateDoc(doc(db, "users", selectedVerification.userId), {
      isSellerVerified: true,
      sellerVerificationStatus: "approved"
    });

    closeVerifyModal();
    loadVerifications();
    alert("✅ Seller approved!");
  } catch (err) {
    console.error(err);
    alert("Failed to approve");
  }
};

window.rejectVerification = async function() {
  const reason = prompt("Reason for rejection:");
  if (!reason) return;

  try {
    await updateDoc(doc(db, "seller_verifications", selectedVerification.id), {
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: new Date()
    });

    closeVerifyModal();
    loadVerifications();
    alert("❌ Seller rejected");
  } catch (err) {
    console.error(err);
    alert("Failed to reject");
  }
};