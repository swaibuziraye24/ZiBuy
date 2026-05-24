// ============================================
// ZiBuy — Admin Verification System
// ============================================

import {
  db,
  auth,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// ADMIN PROTECTION
// ============================================

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const currentEmail = user.email?.trim().toLowerCase();

  if (currentEmail !== ADMIN_EMAIL.toLowerCase()) {
    window.location.href = "index.html";
    return;
  }

  // Admin verified
  loadVerificationRequests();

});

// ============================================
// GLOBALS
// ============================================

let currentFilter = "pending";
let currentVerificationId = null;

// ============================================
// LOAD VERIFICATION REQUESTS
// ============================================

async function loadVerificationRequests() {

  const container = document.getElementById("verification-requests");

  if (!container) return;

  container.innerHTML = `
    <div style="padding:40px;text-align:center;color:#6b7280">
      Loading verification requests...
    </div>
  `;

  try {

    const q = query(
      collection(db, "verifications"),
      where("status", "==", currentFilter)
    );

    const snapshot = await getDocs(q);

    container.innerHTML = "";

    // EMPTY STATE
    if (snapshot.empty) {

      container.innerHTML = `
        <div class="empty-verification">
          <div style="font-size:55px">📭</div>
          <h3>No ${currentFilter} requests</h3>
          <p>There are currently no ${currentFilter} seller requests.</p>
        </div>
      `;

      return;
    }

    // RENDER REQUESTS
    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      const statusColor =
        data.status === "approved"
          ? "#10b981"
          : data.status === "rejected"
          ? "#ef4444"
          : "#f59e0b";

      container.innerHTML += `
        <div class="verification-card">

          <div class="verification-top">

            <div class="verification-avatar">
              ${(data.fullName || "S").charAt(0).toUpperCase()}
            </div>

            <div class="verification-info">

              <h3>${data.fullName || "Unknown Seller"}</h3>

              <p>📧 ${data.email || "No Email"}</p>

              <p>📞 ${data.phone || "No Phone"}</p>

              <p>📍 ${data.location || "Uganda"}</p>

            </div>

            <span
              class="verification-status"
              style="background:${statusColor}"
            >
              ${data.status}
            </span>

          </div>

          <button
            class="view-verification-btn"
            onclick="openVerification('${docSnap.id}')"
          >
            View Details
          </button>

        </div>
      `;

    });

  } catch (err) {

    console.error(err);

    container.innerHTML = `
      <div style="padding:40px;text-align:center;color:red">
        Failed to load requests
      </div>
    `;

  }

}

// ============================================
// FILTERS
// ============================================

window.filterVerifications = function(status) {

  currentFilter = status;

  document.querySelectorAll(".verify-filter")
    .forEach(btn => btn.classList.remove("active"));

  const clickedBtn = document.querySelector(
    `.verify-filter[onclick="filterVerifications('${status}')"]`
  );

  if (clickedBtn) {
    clickedBtn.classList.add("active");
  }

  loadVerificationRequests();

};

// ============================================
// OPEN VERIFICATION MODAL
// ============================================

window.openVerification = async function(id) {

  currentVerificationId = id;

  try {

    const snapshot = await getDocs(collection(db, "verifications"));

    let verification = null;

    snapshot.forEach((docSnap) => {

      if (docSnap.id === id) {

        verification = {
          id: docSnap.id,
          ...docSnap.data()
        };

      }

    });

    if (!verification) return;

    document.getElementById("modal-seller-name").textContent =
      verification.fullName || "Seller";

    document.getElementById("modal-content").innerHTML = `

      <div class="verify-detail-group">
        <h4>Full Name</h4>
        <p>${verification.fullName || "-"}</p>
      </div>

      <div class="verify-detail-group">
        <h4>Email</h4>
        <p>${verification.email || "-"}</p>
      </div>

      <div class="verify-detail-group">
        <h4>Phone</h4>
        <p>${verification.phone || "-"}</p>
      </div>

      <div class="verify-detail-group">
        <h4>Location</h4>
        <p>${verification.location || "-"}</p>
      </div>

      <div class="verify-detail-group">
        <h4>National ID</h4>
        <p>${verification.nationalId || "-"}</p>
      </div>

      <div class="verify-detail-group">
        <h4>Status</h4>
        <p>${verification.status || "-"}</p>
      </div>

    `;

    document.getElementById("modal-verify")
      .classList.add("open");

    document.getElementById("overlay")
      .classList.add("active");

  } catch (err) {

    console.error(err);

    showToast("Failed to load details", "error");

  }

};

// ============================================
// CLOSE MODAL
// ============================================

window.closeVerifyModal = function() {

  document.getElementById("modal-verify")
    .classList.remove("open");

  document.getElementById("overlay")
    .classList.remove("active");

};

// ============================================
// APPROVE VERIFICATION
// ============================================

window.approveVerification = async function() {

  if (!currentVerificationId) return;

  try {

    await updateDoc(
      doc(db, "verifications", currentVerificationId),
      {
        status: "approved",
        verified: true,
        approvedAt: new Date()
      }
    );

    showToast("Seller approved ✅", "success");

    closeVerifyModal();

    loadVerificationRequests();

  } catch (err) {

    console.error(err);

    showToast("Approval failed", "error");

  }

};

// ============================================
// REJECT VERIFICATION
// ============================================

window.rejectVerification = async function() {

  if (!currentVerificationId) return;

  try {

    await updateDoc(
      doc(db, "verifications", currentVerificationId),
      {
        status: "rejected",
        verified: false
      }
    );

    showToast("Seller rejected ❌", "info");

    closeVerifyModal();

    loadVerificationRequests();

  } catch (err) {

    console.error(err);

    showToast("Rejection failed", "error");

  }

};

// ============================================
// TOAST
// ============================================

function showToast(message, type = "info") {

  const container = document.getElementById("toast-container");

  if (!container) return;

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);

}
