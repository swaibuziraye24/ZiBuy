import { db, auth, collection, getDocs, query, where, doc, getDoc } from "./firebase.js";

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

    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", userId)
    ));

    const products = productsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const reviewsSnap = await getDocs(query(
      collection(db, "reviews"),
      where("sellerId", "==", userId)
    ));

    const reviews = reviewsSnap.docs.map(doc => doc.data());
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    const verificationSnap = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", userId)
    ));

    const isVerified = !verificationSnap.empty &&
                       verificationSnap.docs[0].data().status === "approved";

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
          <img src="${p.images?.[0] || 'https://via.placeholder.com/100'}" alt="${p.name}">
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
          <p style="margin:6px 0 0;color:#6b7280;font-size:13px">${r.text}</p>
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

loadProfile();