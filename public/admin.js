// ============================================
//   ZiBuy — Admin Module
// ============================================

import {
  db, storage,
  collection, getDocs, addDoc, deleteDoc, doc
} from "./firebase.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { showToast, loadProducts } from "./app.js";


import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

onAuthStateChanged(auth, (user) => {

  // Wait for Firebase auth to finish
  if (user === undefined) return;
  
    // Not logged in
  if (!user) {

    window.location.replace("index.html");

    return;
  }

   // Wrong user
  if (user.email !== ADMIN_EMAIL) {

    window.location.replace("index.html");

    return;
  }

  const isAdmin = user.email === ADMIN_EMAIL;

  // ============ Image Preview ============

  function previewImages(event) {
  if (!event?.target?.files) return;
  const container = document.getElementById("preview-container");
  if (!container) return;
  container.innerHTML = "";

  Array.from(event.target.files).forEach(file => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.className = "preview-image";
      container.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

window.previewImages = previewImages;

// ============ Upload Product ============

 async function addProduct() {
  if (!isAdmin) {
    showToast("Admin access required", "error");
    return;
  }

  const name        = document.getElementById("product-name").value.trim();
  const price       = document.getElementById("product-price").value.trim();
  const category    = document.getElementById("product-category").value;
  const desc        = document.getElementById("product-desc").value.trim();
  const sellerName  = document.getElementById("seller-name").value.trim();
  const sellerPhone = document.getElementById("seller-phone").value.trim();
  const sellerLoc   = document.getElementById("seller-location").value.trim();
  const files       = document.getElementById("product-image").files;

  if (!name || !price || !sellerPhone || files.length === 0) {
    showToast("Please fill all fields including seller phone", "error");
    return;
  }

  const uploadBtn = document.getElementById("upload-btn");
  uploadBtn.textContent = "Uploading...";
  uploadBtn.disabled = true;

  try {
    // Upload all images to Firebase Storage
    let imageUrls = [];
    for (const file of files) {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }

    // Save product to Firestore
    await addDoc(collection(db, "products"), {
      name,
      price:       Number(price),
      category,
      description: desc || "Quality product from ZiBuy marketplace.",
      images:      imageUrls,
      seller: {
        name:     sellerName  || "ZiBuy Seller",
        phone:    sellerPhone,
        location: sellerLoc   || "Uganda"
      },
      createdAt: new Date()
    });

    showToast("Product uploaded successfully! 🎉", "success");

    // Reset form
    document.getElementById("product-name").value         = "";
    document.getElementById("product-price").value        = "";
    document.getElementById("product-desc").value         = "";
    document.getElementById("seller-name").value          = "";
    document.getElementById("seller-phone").value         = "";
    document.getElementById("seller-location").value      = "";
    document.getElementById("product-image").value        = "";
    document.getElementById("preview-container").innerHTML = "";

    loadProducts(); // Refresh product grid

  } catch (err) {
    console.error(err);
    showToast("Upload failed: " + err.message, "error");
  } finally {
    uploadBtn.textContent = "Upload Product";
    uploadBtn.disabled = false;
  }
}

window.addProduct = addProduct;

// ============ Delete Product ============

 async function deleteProduct(productId) {
  if (!isAdmin) return;
  if (!confirm("Delete this product?")) return;
  try {
    await deleteDoc(doc(db, "products", productId));
    showToast("Product deleted", "info");
    loadProducts();
  } catch (err) {
    showToast("Could not delete product", "error");
  }
}

window.deleteProduct = deleteProduct;

// ============ Load Orders ============

 async function loadOrders() {
  const container = document.getElementById("admin-orders");
  if (!container) return;

  container.innerHTML = "<p style='color:#6b7280;font-size:13px'>Loading orders...</p>";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let totalOrders  = 0;
    let totalRevenue = 0;
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = "<p style='color:#6b7280;font-size:13px;text-align:center;padding:20px'>No orders yet</p>";
      document.getElementById("total-orders").textContent  = "0";
      document.getElementById("total-revenue").textContent = "UGX 0";
      return;
    }

    snapshot.forEach((docSnap) => {
      const order   = docSnap.data();
      const orderId = order.orderId || docSnap.id;

      totalOrders  += 1;
      totalRevenue += order.total || 0;

      container.innerHTML += `
        <div class="order-card">
          <h4>📦 ${orderId}</h4>
          <p><strong>Customer:</strong> ${order.customerName}</p>
          <p><strong>Phone:</strong> ${order.customerPhone}</p>
          <p><strong>Location:</strong> ${order.customerLocation}</p>
          <p><strong>Total:</strong> UGX ${(order.total || 0).toLocaleString()}</p>
          <p><strong>Payment:</strong> ${order.paymentMethod || "Cash On Delivery"}</p>
          <span class="order-status">${order.status || "Pending"}</span>
        </div>
      `;
    });

    document.getElementById("total-orders").textContent  = totalOrders;
    document.getElementById("total-revenue").textContent = "UGX " + totalRevenue.toLocaleString();

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red;font-size:13px'>Failed to load orders</p>";
  }
}

window.loadOrders = loadOrders;

});