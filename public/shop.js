import { db, collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc } from "./firebase.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let currentShop = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  loadShop();
});

async function loadShop() {
  const params = new URLSearchParams(window.location.search);
  const shopUserId = params.get("userId");

  if (!shopUserId) {
    document.body.innerHTML = "<p style='text-align:center;padding:40px'>❌ Shop not found</p>";
    return;
  }

  try {
    // Get shop profile
    const shopSnap = await getDocs(query(
      collection(db, "business_profiles"),
      where("userId", "==", shopUserId)
    ));

    if (shopSnap.empty) {
      document.body.innerHTML = "<p style='text-align:center;padding:40px'>❌ Shop not found</p>";
      return;
    }

    currentShop = { id: shopSnap.docs[0].id, ...shopSnap.docs[0].data() };

    // Render shop profile
    document.getElementById("shop-banner").style.backgroundImage = `url('${currentShop.banner}')`;
    document.getElementById("shop-logo").innerHTML = `<img src="${currentShop.logo}" alt="Logo">`;
    document.getElementById("shop-name").textContent = currentShop.shopName;
    document.getElementById("shop-category").textContent = `📍 ${currentShop.location} · ${currentShop.category}`;
    document.getElementById("shop-rating").textContent = currentShop.rating.toFixed(1);
    document.getElementById("shop-products").textContent = currentShop.totalProducts;
    document.getElementById("shop-followers").textContent = currentShop.followers;
    document.getElementById("shop-trust").textContent = currentShop.trustScore;
    document.getElementById("shop-description").textContent = currentShop.description;
    document.getElementById("shop-location").textContent = `📍 ${currentShop.location}`;
    document.getElementById("shop-phone").textContent = `📱 ${currentShop.phone}`;

    // Load shop products
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", shopUserId)
    ));

    const productsContainer = document.getElementById("shop-products-list");
    
    if (productsSnap.empty) {
      productsContainer.innerHTML = "<p style='text-align:center;padding:40px'>No products yet</p>";
    } else {
      productsContainer.innerHTML = productsSnap.docs.map(p => {
        const product = p.data();
        return `
          <div class="product-card">
            <div class="product-image-box">
              <img src="${product.images?.[0] || 'https://via.placeholder.com/100'}" alt="${product.name}">
            </div>
            <div class="product-info">
              <p class="product-cat">${product.category}</p>
              <h4 style="margin:6px 0">${product.name}</h4>
              <p class="product-price">UGX ${Number(product.price).toLocaleString()}</p>
              <button class="btn btn-orange" onclick="window.location.href='product.html?id=${p.id}'" style="width:100%;margin-top:8px;padding:8px;font-size:12px">View</button>
            </div>
          </div>
        `;
      }).join("");
    }

    // Load shop reviews
    const reviewsSnap = await getDocs(query(
      collection(db, "reviews"),
      where("sellerId", "==", shopUserId)
    ));

    const reviewsContainer = document.getElementById("shop-reviews");
    
    if (reviewsSnap.empty) {
      reviewsContainer.innerHTML = "<p style='color:#6b7280;text-align:center;padding:40px'>No reviews yet</p>";
    } else {
      reviewsContainer.innerHTML = reviewsSnap.docs.map(r => {
        const review = r.data();
        return `
          <div style="padding:16px;background:#f3f4f6;border-radius:10px;margin-bottom:12px">
            <p style="margin:0;font-weight:700">${'⭐'.repeat(review.rating)}</p>
            <p style="margin:6px 0;color:#6b7280">${review.text}</p>
            <p style="margin:6px 0;font-size:12px;color:#adb5bd">${review.reviewerEmail} • ${new Date(review.createdAt?.toDate?.()).toLocaleDateString()}</p>
          </div>
        `;
      }).join("");
    }

  } catch (err) {
    console.error("Error loading shop:", err);
    document.body.innerHTML = `<p style='text-align:center;padding:40px'>❌ Error: ${err.message}</p>`;
  }
}

window.followShop = async function() {
  if (!currentUser) {
    alert("Login to follow shops");
    return;
  }

  try {
    // Check if already following
    const followSnap = await getDocs(query(
      collection(db, "shop_followers"),
      where("userId", "==", currentUser.uid),
      where("shopId", "==", currentShop.id)
    ));

    if (!followSnap.empty) {
      alert("You already follow this shop");
      return;
    }

    // Add follower
    await addDoc(collection(db, "shop_followers"), {
      userId: currentUser.uid,
      shopId: currentShop.id,
      shopUserId: currentShop.userId,
      createdAt: new Date()
    });

    // Update follower count
    await updateDoc(doc(db, "business_profiles", currentShop.id), {
      followers: (currentShop.followers || 0) + 1
    });

    alert("✅ You're following this shop!");
    loadShop();
  } catch (err) {
    alert("Error: " + err.message);
  }
};

window.contactSeller = function() {
  if (!currentUser) {
    alert("Login to contact seller");
    return;
  }
  window.location.href = `messages.html?to=${currentShop.userEmail}`;
};