// ============================================
//   ZiBuy — Dashboard / Seller Management
// ============================================

import { db, auth, doc, updateDoc, getDocs, query, where, collection } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let currentProductId = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
});

// ============================================
// UPDATE SELLER PHONE NUMBER
// ============================================

window.updateSellerPhone = async function(productId) {
  const sellerPhone = document.getElementById("seller-phone");
  
  if (!sellerPhone || !sellerPhone.value.trim()) {
    alert("❌ Please enter a phone number");
    return;
  }

  try {
    await updateDoc(doc(db, "products", productId), {
      "seller.phone": sellerPhone.value.trim()
    });
    
    alert("✅ Phone number updated successfully");
    sellerPhone.disabled = true;
  } catch (err) {
    console.error("Phone update error:", err);
    alert("❌ Error updating phone: " + err.message);
  }
};

// ============================================
// LOAD USER PRODUCTS
// ============================================

export async function loadMyProducts() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    ));

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return products;
  } catch (err) {
    console.error("Load products error:", err);
    return [];
  }
}

// ============================================
// EDIT PRODUCT
// ============================================

window.editProduct = function(productId, productName) {
  currentProductId = productId;
  
  // Show edit modal with product details
  const modal = document.getElementById("edit-product-modal");
  if (modal) {
    modal.classList.add("open");
    document.getElementById("edit-product-name").value = productName;
  }
};

// ============================================
// SAVE PRODUCT CHANGES
// ============================================

window.saveProductChanges = async function() {
  if (!currentProductId) return;

  const productName = document.getElementById("edit-product-name")?.value;
  const sellerPhone = document.getElementById("seller-phone")?.value;

  try {
    const updateData = {};
    if (productName) updateData.name = productName;
    if (sellerPhone) updateData["seller.phone"] = sellerPhone;

    await updateDoc(doc(db, "products", currentProductId), updateData);
    
    alert("✅ Product updated successfully");
    closeEditModal();
  } catch (err) {
    console.error("Update error:", err);
    alert("❌ Error: " + err.message);
  }
};

window.closeEditModal = function() {
  const modal = document.getElementById("edit-product-modal");
  if (modal) modal.classList.remove("open");
};