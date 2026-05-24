// ============================================
// ZiBuy — Admin Seller Verification System
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

  container.innerHTML = `<p style="padding:20px;text-align:center;color:#6b7280">Loading verification requests...</p>`;

  try {
    let q;
    
    if (currentFilter === "all") {
      q = query(collection(db, "seller_verifications"));
    } else {
      q = query(
        collection(db, "seller_verifications"),
        where("status", "==", currentFilter)
      );
    }

    const snapshot = await getDocs(q);
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#6b7280">
          <p style="font-size:32px;margin-bottom:12px">📭</p>
          <p>No ${currentFilter} requests</p>
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const statusColor = {
        pending: "#fef3c7",
        approved: "#dcfce7",
        rejected: "#fee2e2"
      };
      const statusTextColor = {
        pending: "#92400e",
        approved: "#16a34a",
        rejected: "#991b1b"
      };

      container.innerHTML += `
        <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0 0 8px;font-weight:700;color:#111827">${data.fullName || "Unknown"}</h3>
            <p style="margin:4px 0;font-size:13px;color:#6b7280">📧 ${data.email || "No Email"}</p>
            <p style="margin:4px 0;font-size:13px;color:#6b7280">📞 ${data.phone || "No Phone"}</p>
            <p style="margin:4px 0;font-size:13px;color:#6b7280">📍 ${data.location || "Uganda"}</p>
            <p style="margin:8px 0 0;font-size:13px;color:#6b7280">🏢 ${data.businessName || "No Business"}</p>
          </div>
          <div style="text-align:right">
            <span style="display:inline-block;background:${statusColor[data.status] || '#f3f4f6'};color:${statusTextColor[data.status] || '#6b7280'};padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:12px;text-transform:capitalize">
              ${data.status || "unknown"}
            </span>
            <div style="display:flex;gap:8px;flex-direction:column">
              <button class="btn btn-orange" onclick="openVerification('${docSnap.id}')" style="padding:8px 12px;font-size:12px;border:none;border-radius:8px;background:#ff6600;color:white;cursor:pointer;font-weight:700">
                👁️ View
              </button>
            </div>
          </div>
        </div>
      `;
    });

  } catch (err) {
    console.error("Error loading verifications:", err);
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:#ef4444">
        <p>❌ Failed to load requests</p>
        <p style="font-size:12px">${err.message}</p>
      </div>
    `;
  }
}

// ============================================
// FILTERS
// ============================================

window.filterVerifications = function(status) {
  currentFilter = status;

  document.querySelectorAll(".verify-filter").forEach(btn => {
    btn.classList.remove("active");
  });

  if (event?.target) {
    event.target.classList.add("active");
  }

  loadVerificationRequests();
};

// ============================================
// OPEN VERIFICATION MODAL
// ============================================

window.openVerification = async function(id) {
  currentVerificationId = id;

  try {
    const snapshot = await getDocs(collection(db, "seller_verifications"));
    let verification = null;

    snapshot.forEach((docSnap) => {
      if (docSnap.id === id) {
        verification = {
          id: docSnap.id,
          ...docSnap.data()
        };
      }
    });

    if (!verification) {
      alert("Verification not found");
      return;
    }

    // Create modal
    const modal = document.createElement("div");
    modal.className = "modal open";
    modal.id = "verification-modal";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";

    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-size:18px;font-weight:800">Seller Verification</h2>
          <button onclick="closeVerifyModal()" style="background:none;border:none;font-size:24px;cursor:pointer">×</button>
        </div>

        <div style="background:#f9fafb;padding:16px;border-radius:12px;margin-bottom:20px">
          <h3 style="margin:0 0 12px;font-weight:700;font-size:16px">${verification.fullName || "Unknown"}</h3>
          
          <p style="margin:8px 0;color:#6b7280;font-size:13px"><strong>Email:</strong> ${verification.email || "-"}</p>
          <p style="margin:8px 0;color:#6b7280;font-size:13px"><strong>Phone:</strong> ${verification.phone || "-"}</p>
          <p style="margin:8px 0;color:#6b7280;font-size:13px"><strong>Business:</strong> ${verification.businessName || "-"}</p>
          <p style="margin:8px 0;color:#6b7280;font-size:13px"><strong>Location:</strong> ${verification.location || "-"}</p>
          
          <p style="margin:12px 0 0;color:#6b7280;font-size:13px"><strong>About Business:</strong></p>
          <p style="margin:4px 0;color:#111827;font-size:13px;line-height:1.5">${verification.bio || "No bio provided"}</p>
        </div>

        <!-- PAYMENT INFO -->
        <div style="background:#fff7ed;border-left:4px solid #ff6600;padding:16px;border-radius:8px;margin-bottom:20px">
          <h4 style="margin:0 0 8px;color:#ff6600;font-weight:800">💳 Payment Info</h4>
          <p style="margin:4px 0;color:#111827;font-size:13px"><strong>Amount:</strong> UGX ${verification.paymentAmount?.toLocaleString() || "50,000"}</p>
          <p style="margin:4px 0;color:#111827;font-size:13px"><strong>Status:</strong> ${verification.paymentStatus || "Pending"}</p>
          <p style="margin:8px 0 0;color:#111827;font-size:12px"><strong>Applied:</strong> ${new Date(verification.createdAt?.toDate()).toLocaleDateString() || "-"}</p>
        </div>

        <div style="background:#fffbeb;border:1.5px solid #fde68a;padding:12px;border-radius:8px;margin-bottom:20px;font-size:12px;color:#92400e">
          ℹ️ Confirm payment received from WhatsApp before approving
        </div>

        <!-- ===== PUT THE BUTTON CODE HERE ===== -->
        <div style="display:flex;gap:10px">
          ${verification.status === "pending" ? `
            <button onclick="contactSellerWhatsApp('${verification.phone}', '${verification.fullName}')" style="flex:1;padding:12px;background:#25d366;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700">💬 Message Seller</button>
            <button onclick="approveVerification('${id}')" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700">✅ Approve</button>
            <button onclick="rejectVerification('${id}')" style="flex:1;padding:12px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700">❌ Reject</button>
          ` : `<span style="flex:1;text-align:center;padding:12px;color:#6b7280;font-weight:700;text-transform:capitalize">${verification.status}</span>`}
          <button onclick="closeVerifyModal()" style="flex:1;padding:12px;border:1.5px solid #e5e7eb;background:white;border-radius:8px;cursor:pointer;font-weight:700">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById("overlay").classList.add("active");

  } catch (err) {
    console.error("Error viewing verification:", err);
    alert("Failed to load verification details");
  }
};
// ============================================
// CLOSE MODAL
// ============================================

window.closeVerifyModal = function() {
  const modal = document.getElementById("verification-modal");
  if (modal) modal.remove();

  const overlay = document.getElementById("overlay");
  if (overlay) overlay.classList.remove("active");
};

// ============================================
// APPROVE VERIFICATION
// ============================================

window.approveVerification = async function(id) {
  if (!id) return;

  if (!confirm("Approve this seller for verification?")) return;

  try {
    await updateDoc(doc(db, "seller_verifications", id), {
      status: "approved",
      approvedAt: new Date()
    });

    showToast("✅ Seller approved!", "success");
    closeVerifyModal();
    loadVerificationRequests();

  } catch (err) {
    console.error("Error approving:", err);
    showToast("❌ Approval failed: " + err.message, "error");
  }
};

// ============================================
// REJECT VERIFICATION
// ============================================

window.rejectVerification = async function(id) {
  if (!id) return;

  const reason = prompt("Reason for rejection (optional):");

  try {
    await updateDoc(doc(db, "seller_verifications", id), {
      status: "rejected",
      rejectionReason: reason || "No reason provided"
    });

    showToast("❌ Seller rejected", "info");
    closeVerifyModal();
    loadVerificationRequests();

  } catch (err) {
    console.error("Error rejecting:", err);
    showToast("❌ Rejection failed: " + err.message, "error");
  }
};

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.style.cssText = `
    background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#ff6600"};
    color: white;
    padding: 14px 20px;
    border-radius: 10px;
    margin-bottom: 10px;
    font-weight: 700;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}


// ============================================
// CONTACT SELLER VIA WHATSAPP
// ============================================

window.contactSellerWhatsApp = function(sellerPhone, sellerName) {
  const message = `Hi ${sellerName},\n\nYour seller verification has been received. We'll review it within 24 hours.\n\nThank you! 🙏`;
  const whatsappURL = `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, "_blank");
};