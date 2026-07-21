import { db, auth, collection, getDocs, query, where, doc, getDoc, updateDoc, addDoc } from "./firebase.js";
import "./report-seller.js";
import { renderTrustBadge } from "./trust-badge.js";
import { renderEarnedBadge } from "./earned-badge.js";
import { renderResponseBadge } from "./response-badge.js";
import { renderEarnedBadge } from "./earned-badge.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const email = params.get("email");

if (!userId && !email) {
  window.location.href = "index.html";
}

async function loadProfile() {
  try {
    let userEmail = email;
    let userData = null;

    if (userId) {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) {
        userData = userSnap.data();
        userEmail = userData.email;
      }
    }

    const [productsSnap, reviewsSnap, verificationSnap] = await Promise.all([
      getDocs(query(
        collection(db, "products"),
        where("userId", "==", userId),
        where("status", "==", "active")
      )),
      getDocs(query(
        collection(db, "reviews"),
        where("sellerId", "==", userId)
      )),
      getDocs(query(
        collection(db, "seller_verifications"),
        where("userId", "==", userId)
      ))
    ]);

    const products = productsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const reviews = reviewsSnap.docs.map(doc => doc.data());
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    const isVerified    = !verificationSnap.empty &&
                          verificationSnap.docs[0].data().status === "approved";
    const phoneVerified = userData?.phoneVerified === true;

    const sellerName     = products.length > 0 ? products[0].seller?.name     || "Seller" : "Seller";
    const sellerLocation = products.length > 0 ? products[0].seller?.location || "Uganda" : "Uganda";

    document.getElementById("profile-name").textContent     = sellerName + (isVerified ? " ✅" : "");
    document.getElementById("profile-location").textContent = "📍 " + sellerLocation;
    document.getElementById("profile-rating").textContent   = `⭐ ${avgRating} (${reviews.length} reviews)`;
    document.getElementById("stat-products").textContent    = products.length;
    document.getElementById("stat-reviews").textContent     = reviews.length;
    document.getElementById("stat-rating").textContent      = avgRating;

    if (isVerified) {
      document.getElementById("profile-verified").style.display = "inline-block";
      const avatarEl = document.getElementById("profile-avatar");
      if (avatarEl) {
        avatarEl.style.background  = "linear-gradient(135deg, #10b981, #059669)";
        avatarEl.style.boxShadow   = "0 0 12px rgba(16, 185, 129, 0.3)";
      }
    }

    if (phoneVerified) {
      const badge = document.getElementById("phone-verified-badge");
      if (badge) badge.style.display = "inline-flex";
    }

    renderTrustBadge(userId, "profile-trust-badge");
    renderEarnedBadge(userId, "profile-earned-badge");
    renderResponseBadge(userId, "profile-response-badge");

    // Plan badge
    try {
      const { fetchUserPlan } = await import("./business-plans.js");
      const plan = await fetchUserPlan(userId);
      if (plan.id !== "free") {
        const badge  = document.getElementById("profile-plan-badge");
        const styles = {
          bronze: "background:#fef3c7;color:#92400e",
          silver: "background:#f1f5f9;color:#475569",
          gold:   "background:#fffbeb;color:#b45309"
        };
        badge.setAttribute("style",
          `display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:800;${styles[plan.id] || ""}`
        );
        badge.textContent = `${plan.icon} ${plan.name}`;
      }
    } catch (e) { console.warn(e); }

    // Set contact info
    window.sellerPhone = products.length > 0 ? products[0].seller?.phone : "";
    window.sellerEmail = userEmail;
    window.sellerName  = sellerName;

    // Render products
    const productsContainer = document.getElementById("seller-products");
    if (products.length === 0) {
      productsContainer.innerHTML = "<p style='color:#6b7280'>No products yet</p>";
    } else {
      productsContainer.innerHTML = products.slice(0, 6).map(p => `
        <div class="profile-product-card" onclick="window.location.href='product.html?id=${p.id}'">
          <img src="${p.images?.[0] || 'https://zibuy-5deae.web.app/icons/icon-512.png/100'}" alt="${p.name}">
          <div>
            <h4>${p.name}</h4>
            <p style="color:#ff6600;font-weight:700">UGX ${Number(p.price).toLocaleString()}</p>
          </div>
        </div>
      `).join("");
    }

    // Render reviews
    const reviewsContainer = document.getElementById("seller-reviews");
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = "<p style='color:#6b7280'>No reviews yet</p>";
    } else {
      reviewsContainer.innerHTML = reviews.slice(0, 5).map(r => `
        <div style="padding:14px;background:#f9fafb;border-radius:10px;border-left:4px solid #ff6600">
          <p style="margin:0;font-weight:700">${"⭐".repeat(r.rating)}</p>
          <p style="margin:6px 0 0;color:#6b7280;font-size:13px">${r.text || r.reviewText || "—"}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#adb5bd">${r.reviewerEmail} • ${new Date(r.createdAt.toDate()).toLocaleDateString()}</p>
        </div>
      `).join("");
    }

  } catch (err) {
    console.error(err);
    document.body.innerHTML = "<div style='text-align:center;padding:60px 20px'><p>Seller not found</p><a href='index.html' class='btn btn-orange'>← Back</a></div>";
  }
}

window.contactWhatsApp = function() {
  if (!window.sellerPhone) {
    alert("Phone number not available");
    return;
  }
  const message = `Hi ${window.sellerName}, I'm interested in your products!`;
  window.open(`https://wa.me/${window.sellerPhone}?text=${encodeURIComponent(message)}`);
};

window.contactPhone = function() {
  if (!window.sellerPhone) {
    alert("Phone number not available");
    return;
  }
  window.location.href = `tel:${window.sellerPhone}`;
};

window.messageProfile = function() {
  if (!window.sellerEmail) {
    alert("Cannot message at this time");
    return;
  }
  window.location.href = `messages.html?to=${window.sellerEmail}`;
};

window.reportThisSeller = function() {
  openReportModal(userId, window.sellerName || "Seller", "", "");
};

loadProfile();

// ── Check if viewer is the owner — show Edit button ──
onAuthStateChanged(auth, (user) => {
  if (user && user.uid === userId) {
    const editBtn = document.getElementById("edit-profile-btn");
    if (editBtn) editBtn.style.display = "block";

    // Hide "Send Message" — no point messaging yourself
    const msgBtn = document.querySelector("button[onclick='messageProfile()']");
    if (msgBtn) msgBtn.style.display = "none";

    // Show "Verify Phone" button only to the profile owner, and only if not yet verified
    getDoc(doc(db, "users", userId)).then(snap => {
      const data = snap.exists() ? snap.data() : {};
      if (!data.phoneVerified) {
        const verifyBtn = document.getElementById("verify-phone-btn");
        if (verifyBtn) verifyBtn.style.display = "inline-block";
      }
    });
  }
});


// ============================================
// EDIT PROFILE
// ============================================

window.openEditProfile = async function() {
  try {
    // Pre-fill from Firestore user doc
    const userSnap = await getDoc(doc(db, "users", userId));
    const userData = userSnap.exists() ? userSnap.data() : {};

    // Also get latest seller info from their products
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", userId),
      where("status", "==", "active")
    ));
    const firstProduct = productsSnap.docs[0]?.data();

    // Fill fields — prefer user doc, fallback to product seller data
    document.getElementById("ep-name").value     = userData.displayName     || firstProduct?.seller?.name     || "";
    document.getElementById("ep-phone").value    = userData.phone           || firstProduct?.seller?.phone    || "";
    document.getElementById("ep-location").value = userData.location        || firstProduct?.seller?.location || "";
    document.getElementById("ep-bio").value      = userData.bio             || "";

    // Show modal
    document.getElementById("edit-profile-modal").style.display = "flex";

  } catch (err) {
    console.error("openEditProfile error:", err);
    alert("Failed to load profile data");
  }
};

window.closeEditProfile = function() {
  document.getElementById("edit-profile-modal").style.display = "none";
};

window.saveProfile = async function() {
  const name     = document.getElementById("ep-name").value.trim();
  const phone    = document.getElementById("ep-phone").value.trim();
  const location = document.getElementById("ep-location").value;
  const bio      = document.getElementById("ep-bio").value.trim();

  if (!name) {
    document.getElementById("ep-name").style.borderColor = "#ef4444";
    document.getElementById("ep-name").focus();
    return;
  }

  const btn = document.getElementById("ep-save-btn");
  btn.textContent = "Saving...";
  btn.disabled    = true;

  try {
    // 1. Update user doc
    await updateDoc(doc(db, "users", userId), {
      displayName: name,
      phone,
      location,
      bio,
      updatedAt: new Date()
    });

    // 2. Update seller info on all their products
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", userId),
      where("status", "==", "active")
    ));

    const updates = productsSnap.docs.map(d =>
      updateDoc(doc(db, "products", d.id), {
        "seller.name":     name,
        "seller.phone":    phone,
        "seller.location": location,
        updatedAt: new Date()
      })
    );
    await Promise.all(updates);

    // 3. Update page display immediately from form values
    const updatedName     = name;
    const updatedLocation = document.getElementById("ep-location")?.value || "";

    const nameEl = document.getElementById("profile-name");
    const locEl  = document.getElementById("profile-location");
    if (nameEl) nameEl.textContent = updatedName;
    if (locEl)  locEl.textContent  = "📍 " + updatedLocation;

    window.sellerPhone = phone;
    window.sellerName  = name;

    closeEditProfile();

    // Show success toast
    const toast = document.createElement("div");
    toast.className   = "toast success";
    toast.textContent = "✅ Profile updated!";
    document.getElementById("toast-container").appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (err) {
    console.error("saveProfile error:", err);
    alert("❌ Failed to save: " + err.message);
  } finally {
    btn.textContent = "💾 Save Changes";
    btn.disabled    = false;
  }
};